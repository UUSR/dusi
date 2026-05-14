package com.dusi

import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray

class VoiceNotificationsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "VoiceNotifications"

    @ReactMethod
    fun getSettings(promise: Promise) {
        try {
            val enabled = VoiceNotificationsPrefs.isEnabled(reactContext)
            val accessGranted = isNotificationAccessGrantedInternal()

            val map = Arguments.createMap()
            map.putBoolean("enabled", enabled)
            map.putString("mode", VoiceNotificationsPrefs.getMode(reactContext))
            map.putBoolean("accessGranted", accessGranted)

            val selectedArray = Arguments.createArray()
            VoiceNotificationsPrefs.getSelectedPackages(reactContext)
                .sorted()
                .forEach { selectedArray.pushString(it) }
            map.putArray("selectedPackages", selectedArray)

            if (enabled && accessGranted) {
                requestListenerRebind(aggressive = true)
            }

            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("VOICE_NOTIF_SETTINGS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setEnabled(enabled: Boolean, promise: Promise) {
        try {
            VoiceNotificationsPrefs.setEnabled(reactContext, enabled)
            if (enabled) {
                requestListenerRebind(aggressive = true)
            } else {
                val intent = Intent(reactContext, VoiceNotificationsService::class.java)
                intent.action = VoiceNotificationsService.ACTION_STOP_SPEECH
                reactContext.startService(intent)
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("VOICE_NOTIF_SET_ENABLED_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setMode(mode: String, promise: Promise) {
        try {
            VoiceNotificationsPrefs.setMode(reactContext, mode)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("VOICE_NOTIF_SET_MODE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setSelectedPackages(packages: ReadableArray, promise: Promise) {
        try {
            val selected = mutableSetOf<String>()
            for (i in 0 until packages.size()) {
                val pkg = packages.getString(i)?.trim().orEmpty()
                if (pkg.isNotEmpty()) {
                    selected.add(pkg)
                }
            }
            VoiceNotificationsPrefs.setSelectedPackages(reactContext, selected)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("VOICE_NOTIF_SET_PACKAGES_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getInstalledApps(includeSystem: Boolean, promise: Promise) {
        try {
            val pm = reactContext.packageManager
            val installed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getInstalledApplications(android.content.pm.PackageManager.ApplicationInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                pm.getInstalledApplications(0)
            }

            val array = Arguments.createArray()
            installed
                .asSequence()
                .filter { appInfo ->
                    val isSystem = (appInfo.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0
                    includeSystem || !isSystem
                }
                .sortedBy { appInfo ->
                    pm.getApplicationLabel(appInfo)?.toString()?.lowercase() ?: appInfo.packageName.lowercase()
                }
                .forEach { appInfo ->
                    val isSystem = (appInfo.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0
                    val appMap = Arguments.createMap()
                    appMap.putString("packageName", appInfo.packageName)
                    appMap.putString("label", pm.getApplicationLabel(appInfo)?.toString() ?: appInfo.packageName)
                    appMap.putBoolean("isSystem", isSystem)
                    array.pushMap(appMap)
                }

            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("VOICE_NOTIF_APPS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isNotificationAccessGranted(promise: Promise) {
        try {
            promise.resolve(isNotificationAccessGrantedInternal())
        } catch (e: Exception) {
            promise.reject("VOICE_NOTIF_ACCESS_CHECK_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openNotificationAccessSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("VOICE_NOTIF_OPEN_SETTINGS_ERROR", e.message, e)
        }
    }

    private fun isNotificationAccessGrantedInternal(): Boolean {
        val enabledListeners = Settings.Secure.getString(
            reactContext.contentResolver,
            "enabled_notification_listeners"
        ) ?: return false

        val cn = ComponentName(reactContext, VoiceNotificationsService::class.java)
        return enabledListeners.split(':').any { component ->
            ComponentName.unflattenFromString(component) == cn
        }
    }

    private fun requestListenerRebind(aggressive: Boolean) {
        try {
            val cn = ComponentName(reactContext, VoiceNotificationsService::class.java)
            if (aggressive) {
                val pm = reactContext.packageManager
                pm.setComponentEnabledSetting(
                    cn,
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP,
                )
                pm.setComponentEnabledSetting(
                    cn,
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                    PackageManager.DONT_KILL_APP,
                )
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                android.service.notification.NotificationListenerService.requestRebind(cn)
            }
            Log.d("VoiceNotifications", "Listener rebind requested. aggressive=$aggressive")
        } catch (_: Exception) {
            // Ignore and let the system reconnect listener automatically.
        }
    }
}
