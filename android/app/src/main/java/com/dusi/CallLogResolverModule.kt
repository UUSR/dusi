package com.dusi

import android.provider.CallLog
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class CallLogResolverModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "CallLogResolver"

    @ReactMethod
    fun getLatestIncomingCall(maxAgeMs: Double, promise: Promise) {
        try {
            val projection = arrayOf(
                CallLog.Calls.NUMBER,
                CallLog.Calls.CACHED_NAME,
                CallLog.Calls.DATE,
                CallLog.Calls.TYPE,
            )

            val now = System.currentTimeMillis()
            val safeMaxAge = maxAgeMs.toLong().coerceAtLeast(0L)
            val minDate = if (safeMaxAge == 0L) 0L else now - safeMaxAge

            val selection = "${CallLog.Calls.TYPE} = ? AND ${CallLog.Calls.DATE} >= ?"
            val selectionArgs = arrayOf(
                CallLog.Calls.INCOMING_TYPE.toString(),
                minDate.toString(),
            )

            reactContext.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                selection,
                selectionArgs,
                "${CallLog.Calls.DATE} DESC",
            )?.use { cursor ->
                if (!cursor.moveToFirst()) {
                    promise.resolve(null)
                    return
                }

                val number = cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER)) ?: ""
                val cachedName = cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.CACHED_NAME)) ?: ""
                val date = cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls.DATE))

                val result = Arguments.createMap().apply {
                    putString("number", number)
                    putString("cachedName", cachedName)
                    putDouble("date", date.toDouble())
                }
                promise.resolve(result)
                return
            }

            promise.resolve(null)
        } catch (error: SecurityException) {
            promise.reject("CALL_LOG_PERMISSION_DENIED", error.message, error)
        } catch (error: Exception) {
            promise.reject("CALL_LOG_RESOLVE_FAILED", error.message, error)
        }
    }
}
