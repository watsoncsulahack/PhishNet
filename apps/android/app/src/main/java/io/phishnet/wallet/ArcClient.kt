package io.phishnet.wallet

import org.json.JSONObject
import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode
import java.net.URL
import javax.net.ssl.HttpsURLConnection

object ArcClient {
    private fun rpc(method: String, params: String): String {
        val connection = URL("https://rpc.testnet.arc.io").openConnection() as HttpsURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15000
            connection.readTimeout = 15000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.outputStream.use { it.write("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$method\",\"params\":$params}".toByteArray()) }
            check(connection.responseCode == 200) { "Network unavailable. Try again." }
            val text = connection.inputStream.bufferedReader().use { it.readText() }
            val response = JSONObject(text)
            check(!response.has("error")) { "Network could not return a balance." }
            return response.getString("result")
        } finally { connection.disconnect() }
    }
    fun balance(address: String): String {
        require(Regex("^0x[0-9a-fA-F]{40}$").matches(address))
        check(BigInteger(rpc("eth_chainId", "[]").removePrefix("0x"), 16) == BigInteger("5042002")) { "Wrong network. Connection stopped." }
        val amount = BigInteger(rpc("eth_getBalance", "[\"$address\",\"latest\"]").removePrefix("0x"), 16)
        // Arc native USDC uses 18 decimals. ERC-20 USDC uses 6; never mix them.
        return formatNativeBalance(amount)
    }
}
internal fun formatNativeBalance(wei: BigInteger): String = BigDecimal(wei).movePointLeft(18).setScale(2, RoundingMode.DOWN).toPlainString()
