package io.phishnet.wallet

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.web3j.crypto.Keys
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** No private key leaves this class. No signing/export interface in this preview. */
class WalletStore(context: Context) {
    private val prefs = context.getSharedPreferences("wallet", Context.MODE_PRIVATE)
    private val alias = "phishnet.wallet.v1"
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        // Never replace a missing encryption key for an existing wallet.
        check(!prefs.contains("ciphertext")) { "Wallet key unavailable. Do not clear app data." }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    @Synchronized fun address(): String? {
        val encrypted = prefs.getString("ciphertext", null) ?: return null
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(prefs.getString("iv", null), Base64.NO_WRAP)))
        val bytes = cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP))
        return try {
            val pair = org.web3j.crypto.ECKeyPair.create(bytes)
            Keys.toChecksumAddress("0x" + Keys.getAddress(pair))
        } finally { bytes.fill(0) }
    }
    @Synchronized fun create(): String {
        check(!prefs.contains("ciphertext")) { "A wallet already exists on this device." }
        val pair = Keys.createEcKeyPair()
        val bytes = org.web3j.utils.Numeric.toBytesPadded(pair.privateKey, 32)
        try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, key())
            val encrypted = cipher.doFinal(bytes)
            check(prefs.edit().putString("ciphertext", Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .putString("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP)).commit()) { "Wallet could not be saved." }
            return Keys.toChecksumAddress("0x" + Keys.getAddress(pair))
        } finally { bytes.fill(0) }
    }
}
