package io.phishnet.wallet

import org.junit.Assert.*
import org.junit.Test
import java.math.BigInteger

class WalletTest {
    @Test fun nativeUsdcUsesEighteenDecimals() {
        assertEquals("1.00", formatNativeBalance(BigInteger.TEN.pow(18)))
        assertEquals("0.00", formatNativeBalance(BigInteger.ZERO))
        assertEquals("0.00", formatNativeBalance(BigInteger("1000000")))
        assertEquals("1.23", formatNativeBalance(BigInteger("1239999999999999999")))
    }
    @Test fun assistantNeverClaimsToSendOrEarn() {
        assertTrue(assistantReply("send a payment").contains("not enabled"))
        assertTrue(assistantReply("earn money").contains("can't"))
        assertTrue(assistantReply("hello").contains("not an online AI"))
    }
}
