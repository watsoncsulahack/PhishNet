package io.phishnet.wallet

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class WalletDeviceTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    @Test fun onboardingRequiresAcknowledgement() {
        compose.onNodeWithText("Create test wallet").assertIsNotEnabled()
        compose.onNode(isToggleable()).performClick()
        compose.onNodeWithText("Create test wallet").assertIsEnabled()
    }
    @Test fun encryptedWalletSurvivesStoreRecreation() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val store = WalletStore(context)
        try {
            val address = store.address() ?: store.create()
            assertTrue(address.matches(Regex("0x[0-9a-fA-F]{40}")))
            assertEquals(address, WalletStore(context).address())
            try { store.create(); fail("Must not replace an existing wallet") } catch (_: IllegalStateException) { }
        } finally {
            context.getSharedPreferences("wallet", android.content.Context.MODE_PRIVATE).edit().clear().commit()
        }
    }
}
