# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# --- Capacitor / WebView JS bridge ---
# Capacitor uses WebView with addJavascriptInterface; ProGuard must
# keep those classes or the bridge silently breaks (black screen).
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keepattributes JavascriptInterface

# Keep Capacitor bridge and plugin classes
-keep class com.getcapacitor.** { *; }
-keep class com.zemichat.app.** { *; }

# Keep Cordova plugin classes (used by some Capacitor plugins)
-keep class org.apache.cordova.** { *; }

# Preserve line numbers for crash stack traces
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
