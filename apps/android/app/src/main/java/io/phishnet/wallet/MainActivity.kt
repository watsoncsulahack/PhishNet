package io.phishnet.wallet

import android.app.Application
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

internal data class WalletUi(
    val loading: Boolean = true,
    val address: String? = null,
    val balance: String? = null,
    val error: String? = null,
    val checked: Boolean = false
)

class WalletViewModel(application: Application) : AndroidViewModel(application) {
    private val store = WalletStore(application)
    private val mutable = MutableStateFlow(WalletUi())
    internal val state = mutable.asStateFlow()
    init {
        viewModelScope.launch {
            try {
                val address = withContext(Dispatchers.IO) { store.address() }
                mutable.value = WalletUi(loading = false, address = address)
                if (address != null) refresh()
            } catch (_: Exception) {
                mutable.value = WalletUi(loading = false, error = "Your wallet could not be unlocked. Do not uninstall or clear app data. Restart the app to retry.")
            }
        }
    }
    fun create() {
        if (mutable.value.loading || mutable.value.error != null || mutable.value.address != null) return
        mutable.value = mutable.value.copy(loading = true)
        viewModelScope.launch {
            try {
                val address = withContext(Dispatchers.IO) { store.create() }
                mutable.value = WalletUi(loading = false, address = address)
                refresh()
            } catch (_: Exception) {
                mutable.value = WalletUi(loading = false, error = "Could not create your wallet safely. Restart the app to retry.")
            }
        }
    }
    fun refresh() {
        val address = mutable.value.address ?: return
        if (mutable.value.loading) return
        mutable.value = mutable.value.copy(loading = true, error = null)
        viewModelScope.launch {
            try {
                val balance = withContext(Dispatchers.IO) { ArcClient.balance(address) }
                mutable.value = mutable.value.copy(loading = false, balance = balance, checked = true)
            } catch (_: Exception) {
                mutable.value = mutable.value.copy(loading = false, error = "We couldn't check your balance. Check your connection and try again.")
            }
        }
    }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        setContent { PhishNetApp() }
    }
}

private val Ink = Color(0xFF173D35)
private val Mint = Color(0xFFBBF0D2)
private val Paper = Color(0xFFF6F8F3)

@Composable
internal fun PhishNetApp(vm: WalletViewModel = viewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    var tab by remember { mutableIntStateOf(0) }
    var acknowledged by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    fun copyAddress() {
        val address = state.address ?: return
        (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager)
            .setPrimaryClip(ClipData.newPlainText("Public test wallet address", address))
        scope.launch { snackbar.showSnackbar("Wallet address copied") }
    }
    fun faucet() { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://faucet.circle.com"))) }
    MaterialTheme(colorScheme = lightColorScheme(primary = Ink, onPrimary = Color.White,
        primaryContainer = Mint, onPrimaryContainer = Ink, background = Paper,
        surface = Paper, onSurface = Ink, onBackground = Ink)) {
        Scaffold(snackbarHost = { SnackbarHost(snackbar) }, bottomBar = {
            if (state.address != null) NavigationBar(containerColor = Paper) {
                listOf("Wallet" to Icons.Outlined.AccountBalanceWallet, "Assistant" to Icons.Outlined.ChatBubbleOutline,
                    "Safety" to Icons.Outlined.Shield).forEachIndexed { index, item ->
                    NavigationBarItem(selected = tab == index, onClick = { tab = index },
                        icon = { Icon(item.second, contentDescription = null) }, label = { Text(item.first) })
                }
            }
        }) { padding ->
            Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("PhishNet", fontSize = 24.sp, fontWeight = FontWeight.Bold)
                    SuggestionChip(onClick = { tab = 2 }, label = { Text("Test money only") })
                }
                state.error?.let { Notice("Something needs attention", it) }
                if (state.address == null) {
                    Spacer(Modifier.height(24.dp))
                    Icon(Icons.Outlined.Shield, contentDescription = null, modifier = Modifier.size(64.dp))
                    Text("Your money.\nYour say.", fontSize = 44.sp, lineHeight = 49.sp, fontWeight = FontWeight.Bold)
                    Text("A calmer way to explore payments with an assistant. Start empty, add free test funds, and stay in control.", fontSize = 18.sp)
                    Notice("A safe place to try", "This early version uses test money with no cash value. Payments are not enabled yet.")
                    Row {
                        Checkbox(checked = acknowledged, onCheckedChange = { acknowledged = it })
                        Text("I understand: this wallet stays on this phone. Uninstalling the app or losing the phone loses access. There is no recovery yet.", Modifier.padding(top = 12.dp))
                    }
                    Button(onClick = vm::create, enabled = acknowledged && !state.loading && state.error == null,
                        modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)) {
                        Text(if (state.loading) "Getting ready…" else "Create test wallet")
                    }
                    Text("No account. No real funds. No private keys sent to a server.", style = MaterialTheme.typography.bodyMedium)
                } else AnimatedContent(targetState = tab, label = "navigation") { page ->
                    Column(verticalArrangement = Arrangement.spacedBy(20.dp), modifier = Modifier.fillMaxWidth()) {
                        when (page) {
                            0 -> {
                                Text("A little peace\nof mind.", fontSize = 36.sp, lineHeight = 41.sp, fontWeight = FontWeight.Bold)
                                Card(colors = CardDefaults.cardColors(containerColor = Ink), shape = RoundedCornerShape(28.dp)) {
                                    Column(Modifier.fillMaxWidth().padding(28.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                        Text("Available test funds", color = Mint)
                                        Text(state.balance?.let { "$it USDC" } ?: "Not checked", color = Color.White,
                                            fontSize = 34.sp, fontWeight = FontWeight.Bold)
                                        Text(if (state.loading) "Checking network…" else if (state.error != null) "Balance may be out of date" else if (state.checked) "From Arc Testnet · not real money" else "Connect to check your balance", color = Mint)
                                    }
                                }
                                Text("Get started", style = MaterialTheme.typography.titleLarge)
                                Notice("1 · Add free test funds", "Copy your address, open Circle's faucet, choose Arc Testnet, and paste it there. The faucet may ask you to sign in or wait.")
                                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    OutlinedButton(onClick = ::copyAddress, modifier = Modifier.weight(1f).heightIn(min = 52.dp)) { Text("Copy address") }
                                    Button(onClick = ::faucet, modifier = Modifier.weight(1f).heightIn(min = 52.dp)) { Text("Open faucet") }
                                }
                                OutlinedButton(onClick = vm::refresh, enabled = !state.loading, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
                                    Text(if (state.loading) "Checking…" else "Check balance")
                                }
                                Notice("2 · Meet your assistant", "Get help adding funds and understanding payment safety. It cannot access your private key or spend your money.")
                                TextButton(onClick = { tab = 1 }) { Text("Talk to assistant →") }
                                Text("Your public address", style = MaterialTheme.typography.labelLarge)
                                Text(state.address.orEmpty(), style = MaterialTheme.typography.bodyMedium)
                            }
                            1 -> Assistant(onFaucet = ::faucet, onCopy = ::copyAddress)
                            else -> {
                                Text("Control, not\ncomplication.", fontSize = 36.sp, lineHeight = 41.sp, fontWeight = FontWeight.Bold)
                                Notice("Your keys stay here", "Your wallet key is encrypted using Android Keystore. Backups and screenshots are disabled. This is not a security audit or a guarantee against every threat.")
                                Notice("No surprise spending", "This preview cannot sign or send payments. The assistant has no spending authority. Future payments need an independent security check and an approval tied to the exact payment details.")
                                Notice("Test money stays test money", "Only Arc Testnet is supported. Never send real funds here. The balance comes from a public network service, not from the assistant.")
                                Notice("Before you rely on it", "Recovery, device authentication for signing, durable spending limits, verified payment approvals, and an independent audit are still needed. Do not uninstall if you want to keep this test wallet.")
                                Text("PhishNet · Android preview 0.1.0", style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Notice(title: String, body: String) {
    Surface(color = Color.White, shape = RoundedCornerShape(22.dp), modifier = Modifier.fillMaxWidth().animateContentSize()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
            Text(body, style = MaterialTheme.typography.bodyLarge)
        }
    }
}

internal fun assistantReply(input: String): String = when {
    listOf("fund", "faucet", "money", "earn").any { input.contains(it, ignoreCase = true) } ->
        "Let's get free test funds. Copy your address below, then open Circle's faucet and choose Arc Testnet. After requesting funds, return to Wallet and tap Check balance. I can't bypass faucet limits or earn money for you."
    listOf("pay", "send", "transfer").any { input.contains(it, ignoreCase = true) } ->
        "Sending is not enabled in this preview. I can't move money or approve a payment. A future version must check who you're paying, the amount, and your spending limit before you approve."
    else -> "I can guide you through getting test funds and explain payment safety. I'm a built-in guide, not an online AI agent. No messages leave this phone. Try asking: How do I add funds?"
}

@Composable
private fun Assistant(onFaucet: () -> Unit, onCopy: () -> Unit) {
    var input by remember { mutableStateOf("") }
    var reply by remember { mutableStateOf(assistantReply("hello")) }
    Text("A helping hand.\nNot the boss.", fontSize = 36.sp, lineHeight = 41.sp, fontWeight = FontWeight.Bold)
    Text("Built-in guide · no spending access", style = MaterialTheme.typography.labelLarge)
    Notice("PhishNet assistant", reply)
    OutlinedTextField(value = input, onValueChange = { input = it.take(500) }, label = { Text("What would you like help with?") }, modifier = Modifier.fillMaxWidth(), maxLines = 4)
    Button(onClick = { reply = assistantReply(input); input = "" }, enabled = input.isNotBlank(), modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) { Text("Ask assistant") }
    OutlinedButton(onClick = { reply = assistantReply("funds") }, modifier = Modifier.fillMaxWidth()) { Text("Help me get test funds") }
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        TextButton(onClick = onCopy) { Text("Copy address") }
        TextButton(onClick = onFaucet) { Text("Open faucet ↗") }
    }
}
