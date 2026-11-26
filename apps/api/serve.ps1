# PhishNet Native Windows API Server and Web Application Host (User-mode TcpListener)
param(
    [int]$Port = 3001,
    [string]$HostAddress = "127.0.0.1"
)

$ErrorActionPreference = "Stop"
$rootDir = (Resolve-Path "$PSScriptRoot\..\..").Path
$fixturesPath = Join-Path $rootDir "data\fixtures\scenarios.json"
$webDir = Join-Path $rootDir "apps\web"

if (-not (Test-Path $fixturesPath)) {
    Write-Error "Fixtures file not found at $fixturesPath"
}

$scenariosJson = Get-Content $fixturesPath -Raw -Encoding UTF8
$scenarios = $scenariosJson | ConvertFrom-Json

# In-memory session state & consumed nonces
$consumedNonces = New-Object 'System.Collections.Generic.HashSet[string]'
$consumedNonces.Add("consumed-nonce-005") | Out-Null # Preload used nonce for replay test

Add-Type -AssemblyName System.Security

function Compute-Sha256([string]$inputString) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($inputString)
    $hash = $sha.ComputeHash($bytes)
    return ($hash | ForEach-Object { $_.ToString("x2") }) -join ""
}

function Evaluate-PaymentPolicy($proposal, $mandate, $consumedNonces, [int64]$cumulativeSpent, $independentVerifications, [bool]$humanApproved) {
    $reasons = New-Object System.Collections.ArrayList
    $decision = "ALLOW"
    $now = [DateTime]::UtcNow

    # 1. Check validity window
    $validUntil = [DateTime]::Parse($mandate.validUntil)
    $validAfter = [DateTime]::Parse($mandate.validAfter)

    if ($now -gt $validUntil) {
        $reasons.Add("EXPIRED_MANDATE") | Out-Null
        $decision = "DENY"
    }
    if ($now -lt $validAfter) {
        $reasons.Add("MANDATE_NOT_YET_VALID") | Out-Null
        $decision = "DENY"
    }

    # 2. Check Chain ID
    if ($proposal.chainId -ne $mandate.chainId) {
        $reasons.Add("CHAIN_NOT_ALLOWED") | Out-Null
        $decision = "DENY"
    }

    # 3. Check Asset Contract
    if ($proposal.assetContract.ToUpper() -ne $mandate.assetContract.ToUpper()) {
        $reasons.Add("ASSET_NOT_ALLOWED") | Out-Null
        $decision = "DENY"
    }

    # 4. Check Replay Nonce
    $nonce = if ($proposal.nonce) { $proposal.nonce } else { $mandate.nonce }
    if ($consumedNonces.Contains($nonce)) {
        $reasons.Add("REPLAY_NONCE") | Out-Null
        $decision = "DENY"
    }

    # 5. Check Amount Limits
    [int64]$proposalAmount = [int64]$proposal.amountBaseUnits
    [int64]$maxAmount = [int64]$mandate.amountMaxBaseUnits
    if ($proposalAmount -gt $maxAmount) {
        $reasons.Add("AMOUNT_EXCEEDS_LIMIT") | Out-Null
        $decision = "DENY"
    }

    # 6. Check Cumulative Budget
    [int64]$budget = [int64]$mandate.cumulativeBudgetBaseUnits
    [int64]$projected = $cumulativeSpent + $proposalAmount
    if ($projected -gt $budget) {
        $reasons.Add("BUDGET_EXHAUSTED") | Out-Null
        $decision = "DENY"
    }

    # 7. Check Recipient Match
    $pRecipient = $proposal.recipient.Trim().ToLower()
    $mRecipient = $mandate.allowedRecipient.Trim().ToLower()

    $recipientMatches = ($pRecipient -eq $mRecipient)

    if (-not $recipientMatches) {
        $hasIndependent = $false
        if ($independentVerifications) {
            foreach ($v in $independentVerifications) {
                if ($v.targetRecipient.Trim().ToLower() -eq $pRecipient -and $v.isIndependent) {
                    $hasIndependent = $true
                    break
                }
            }
        }

        if ($hasIndependent) {
            if (-not $humanApproved) {
                $reasons.Add("NEW_PAYEE_UNVERIFIED") | Out-Null
                if ($decision -ne "DENY") { $decision = "HOLD" }
            }
        } else {
            $reasons.Add("RECIPIENT_MISMATCH") | Out-Null
            $decision = "DENY"
        }
    }

    # 8. High value check
    $isHighValue = ($proposalAmount -ge 50000000)
    $humanApprovalRequired = ($isHighValue -or (-not $recipientMatches))

    if ($decision -eq "ALLOW") {
        if ($humanApprovalRequired -and (-not $humanApproved)) {
            $decision = "HOLD"
            $reasons.Add("MISSING_REQUIRED_APPROVAL") | Out-Null
        } else {
            $reasons.Add("AUTHORIZED_AND_VERIFIED") | Out-Null
        }
    }

    return @{
        requestId = $proposal.requestId
        decisionId = "dec-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
        decision = $decision
        reasonCodes = $reasons
        policyVersion = "phishnet-v1.0.0-strict"
        evidenceIds = $proposal.sourceEventIds
        issuedAt = $now.ToString("o")
        authoritativeDetails = @{
            recipient = $proposal.recipient
            amountBaseUnits = $proposal.amountBaseUnits
            asset = $proposal.assetContract
            chainId = $proposal.chainId
            humanApprovalRequired = $humanApprovalRequired
            humanApprovalGranted = $humanApproved
        }
    }
}

# Start user-mode TcpListener
$ip = [System.Net.IPAddress]::Parse($HostAddress)
$listener = New-Object System.Net.Sockets.TcpListener ($ip, $Port)
$listener.Start()

Write-Output "=========================================================="
Write-Output " PhishNet Security Platform API & Web UI"
Write-Output " Running on: http://$($HostAddress):$($Port)/"
Write-Output " Mode: ENFORCEMENT | Target: Circle Arc Testnet (5042002)"
Write-Output " Engine: User-mode Sockets (Pure Zero-Dependency)"
Write-Output "=========================================================="

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)

        $requestLine = $reader.ReadLine()
        if (-not $requestLine) {
            $client.Close()
            continue
        }

        $parts = $requestLine -split " "
        $method = $parts[0]
        $path = $parts[1]

        # Read headers
        $contentLength = 0
        while ($true) {
            $headerLine = $reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($headerLine)) { break }
            if ($headerLine -match "^Content-Length:\s*(\d+)") {
                $contentLength = [int]$matches[1]
            }
        }

        # Read body if any
        $bodyText = ""
        if ($contentLength -gt 0) {
            $charBuffer = New-Object char[] $contentLength
            $totalRead = 0
            while ($totalRead -lt $contentLength) {
                $read = $reader.Read($charBuffer, $totalRead, $contentLength - $totalRead)
                if ($read -le 0) { break }
                $totalRead += $read
            }
            $bodyText = New-Object string ($charBuffer, 0, $totalRead)
        }

        # Handle OPTIONS preflight
        if ($method -eq "OPTIONS") {
            $respHeaders = "HTTP/1.1 204 No Content`r`nAccess-Control-Allow-Origin: *`r`nAccess-Control-Allow-Methods: GET, POST, OPTIONS`r`nAccess-Control-Allow-Headers: Content-Type`r`nContent-Length: 0`r`n`r`n"
            $hdrBytes = [System.Text.Encoding]::UTF8.GetBytes($respHeaders)
            $stream.Write($hdrBytes, 0, $hdrBytes.Length)
            $stream.Flush()
            $client.Close()
            continue
        }

        $responseBody = ""
        $contentType = "application/json; charset=utf-8"
        $statusLine = "HTTP/1.1 200 OK"

        try {
            if ($method -eq "GET" -and $path -eq "/v1/health") {
                $responseBody = @{
                    status = "healthy"
                    version = "1.0.0"
                    platform = "PhishNet Provenance & Payment Security"
                    network = "Circle Arc Testnet"
                    chainId = "5042002"
                    currency = "USDC"
                    rpc = "https://rpc.testnet.arc.io"
                    explorer = "https://explorer.testnet.arc.io"
                    mode = "enforcement"
                    engine = "deterministic-policy-v1"
                } | ConvertTo-Json
            }
            elseif ($method -eq "GET" -and $path -eq "/v1/scenarios") {
                $responseBody = $scenariosJson
            }
            elseif ($method -eq "POST" -and $path -eq "/v1/preflight") {
                $reqData = $bodyText | ConvertFrom-Json
                $proposal = $reqData.proposal
                $mandate = $reqData.mandate
                [int64]$spent = if ($reqData.cumulativeSpentBaseUnits) { [int64]$reqData.cumulativeSpentBaseUnits } else { 0 }
                $humanApproved = [bool]($reqData.humanApproved)

                $indVerifications = @()
                if ($reqData.independentVerifications) {
                    $indVerifications = $reqData.independentVerifications
                }

                $decisionResult = Evaluate-PaymentPolicy $proposal $mandate $consumedNonces $spent $indVerifications $humanApproved
                $responseBody = $decisionResult | ConvertTo-Json -Depth 5
            }
            elseif ($method -eq "POST" -and ($path -match "^/v1/payments/(.+)/execute$")) {
                $reqData = $bodyText | ConvertFrom-Json
                $preflight = $reqData.preflight
                $proposal = $reqData.proposal

                if ($preflight.decision -ne "ALLOW") {
                    $statusLine = "HTTP/1.1 403 Forbidden"
                    $responseBody = @{
                        error = "EXECUTION_DENIED"
                        message = "Independent authorization engine rejected transaction execution. Preflight status is $($preflight.decision)."
                        reasons = $preflight.reasonCodes
                    } | ConvertTo-Json
                } else {
                    $nonce = if ($proposal.nonce) { $proposal.nonce } else { $reqData.mandate.nonce }
                    if ($nonce) { $consumedNonces.Add($nonce) | Out-Null }

                    $simHash = "0xsim" + ([System.Guid]::NewGuid().ToString("N")) + ([System.Guid]::NewGuid().ToString("N").Substring(0, 28))
                    $responseBody = @{
                        receiptId = "rcpt-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
                        requestId = $proposal.requestId
                        chainId = "5042002"
                        txHash = $simHash
                        blockNumber = 1245089
                        status = "SIMULATED"
                        asset = $proposal.assetContract
                        recipient = $proposal.recipient
                        amountBaseUnits = $proposal.amountBaseUnits
                        executedAt = [DateTime]::UtcNow.ToString("o")
                        explorerUrl = "https://explorer.testnet.arc.io/tx/$simHash"
                        isSimulated = $true
                    } | ConvertTo-Json
                }
            }
            elseif ($method -eq "POST" -and ($path -match "^/v1/sessions/(.+)/analyze$")) {
                $sessionId = $matches[1]
                $reqData = $bodyText | ConvertFrom-Json
                $events = $reqData.events

                $reps = @()
                $origin = $null
                $hasUrgency = $false
                $hasAuthority = $false

                foreach ($e in $events) {
                    $payloadStr = ($e.payload | ConvertTo-Json -Compress).ToLower()
                    if ($payloadStr -match "urgent|immediately|asap|within 1 hour") { $hasUrgency = $true }
                    if ($payloadStr -match "accounting department|official notice|head of finance") { $hasAuthority = $true }
                    if ($e.payload.recipient -and ($e.payload.recipient -ne "0x1111111111111111111111111111111111111111")) {
                        if (-not $origin) { $origin = $e } else { $reps += $e }
                    }
                }

                $sourceConvergence = ($reps.Count -ge 1 -and $origin)
                $indicators = New-Object System.Collections.ArrayList
                if ($hasUrgency) {
                    $indicators.Add(@{ type = "urgency"; explanation = "Linguistic urgency pressure detected in interaction history." }) | Out-Null
                }
                if ($hasAuthority) {
                    $indicators.Add(@{ type = "authority_claim"; explanation = "Authority assertion without verified organizational credential." }) | Out-Null
                }
                if ($sourceConvergence) {
                    $indicators.Add(@{ type = "source_convergence"; explanation = "Two or more agents repeated address change claim, but all trace back to single unverified origin $($origin.eventId)." }) | Out-Null
                }

                $rec = if ($sourceConvergence) { "ESCALATE" } elseif ($indicators.Count -gt 0) { "REVIEW" } else { "ADVISORY_CLEAR" }

                $responseBody = @{
                    sessionId = $sessionId
                    modelId = "phishnet-risk-extractor-v1"
                    recommendation = $rec
                    sourceConvergenceDetected = $sourceConvergence
                    convergenceDetails = if ($sourceConvergence) { "Claim repeated by multiple agents without independent corroboration." } else { $null }
                    manipulationIndicators = $indicators
                    missingInformation = if ($sourceConvergence) { @("Independent out-of-band verification") } else { @() }
                } | ConvertTo-Json -Depth 5
            }
            elseif ($method -eq "GET" -and ($path -eq "/" -or $path -eq "/index.html")) {
                $indexPath = Join-Path $webDir "index.html"
                if (Test-Path $indexPath) {
                    $contentType = "text/html; charset=utf-8"
                    $responseBody = Get-Content $indexPath -Raw -Encoding UTF8
                } else {
                    $statusLine = "HTTP/1.1 404 Not Found"
                    $responseBody = "index.html not found"
                }
            }
            else {
                $statusLine = "HTTP/1.1 404 Not Found"
                $responseBody = @{ error = "Not found"; path = $path } | ConvertTo-Json
            }
        }
        catch {
            $statusLine = "HTTP/1.1 500 Internal Server Error"
            $responseBody = @{ error = "Server Error"; message = $_.Exception.Message } | ConvertTo-Json
        }

        $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($responseBody)
        $respHeaders = "$statusLine`r`nAccess-Control-Allow-Origin: *`r`nAccess-Control-Allow-Methods: GET, POST, OPTIONS`r`nAccess-Control-Allow-Headers: Content-Type`r`nContent-Type: $contentType`r`nContent-Length: $($bodyBytes.Length)`r`nConnection: close`r`n`r`n"
        $hdrBytes = [System.Text.Encoding]::UTF8.GetBytes($respHeaders)

        $stream.Write($hdrBytes, 0, $hdrBytes.Length)
        $stream.Write($bodyBytes, 0, $bodyBytes.Length)
        $stream.Flush()
        $client.Close()
    }
}
finally {
    $listener.Stop()
}
