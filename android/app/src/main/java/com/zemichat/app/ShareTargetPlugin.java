package com.zemichat.app;

import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import android.webkit.MimeTypeMap;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;

@CapacitorPlugin(name = "ShareTarget")
public class ShareTargetPlugin extends Plugin {

    private static final int MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
    private JSObject pendingShareData = null;

    @Override
    public void load() {
        super.load();
        handleIntent(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        String type = intent.getType();

        if (type == null) return;

        JSObject data = null;

        if (Intent.ACTION_SEND.equals(action)) {
            if ("text/plain".equals(type)) {
                data = handleSendText(intent);
            } else if (type.startsWith("image/")) {
                data = handleSendImage(intent);
            }
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action) && type.startsWith("image/")) {
            data = handleSendMultipleImages(intent);
        }

        if (data != null) {
            if (hasListeners("shareReceived")) {
                notifyListeners("shareReceived", data);
                pendingShareData = null;
            } else {
                // JS not ready yet (cold start) — buffer for polling
                pendingShareData = data;
            }
        }
    }

    private JSObject handleSendText(Intent intent) {
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null || text.isEmpty()) return null;

        JSObject data = new JSObject();
        data.put("type", "text");
        data.put("text", text);
        data.put("items", new JSArray());
        return data;
    }

    private JSObject handleSendImage(Intent intent) {
        Uri imageUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (imageUri == null) return null;

        JSObject item = readUri(imageUri);
        if (item == null) return null;

        JSArray items = new JSArray();
        items.put(item);

        // Also grab any text that came along
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);

        JSObject data = new JSObject();
        data.put("type", "image");
        data.put("text", text != null ? text : "");
        data.put("items", items);
        return data;
    }

    private JSObject handleSendMultipleImages(Intent intent) {
        ArrayList<Uri> imageUris = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
        if (imageUris == null || imageUris.isEmpty()) return null;

        JSArray items = new JSArray();
        for (Uri uri : imageUris) {
            JSObject item = readUri(uri);
            if (item != null) {
                items.put(item);
            }
        }

        if (items.length() == 0) return null;

        String text = intent.getStringExtra(Intent.EXTRA_TEXT);

        JSObject data = new JSObject();
        data.put("type", "image");
        data.put("text", text != null ? text : "");
        data.put("items", items);
        return data;
    }

    /**
     * Read a content URI into a base64 string with metadata.
     * Content URIs are temporary so we must read eagerly.
     */
    private JSObject readUri(Uri uri) {
        try {
            InputStream inputStream = getContext().getContentResolver().openInputStream(uri);
            if (inputStream == null) return null;

            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int bytesRead;
            int totalRead = 0;

            while ((bytesRead = inputStream.read(chunk)) != -1) {
                totalRead += bytesRead;
                if (totalRead > MAX_FILE_SIZE) {
                    inputStream.close();
                    return null; // Too large
                }
                buffer.write(chunk, 0, bytesRead);
            }
            inputStream.close();

            byte[] bytes = buffer.toByteArray();
            String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);

            String mimeType = getContext().getContentResolver().getType(uri);
            if (mimeType == null) mimeType = "image/jpeg";

            String fileName = "shared_image";
            String ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType);
            if (ext != null) {
                fileName = "shared_image." + ext;
            }

            JSObject item = new JSObject();
            item.put("mimeType", mimeType);
            item.put("fileName", fileName);
            item.put("base64Data", base64);
            item.put("size", bytes.length);
            return item;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Called from JS to retrieve share data that arrived before the listener was set up (cold start).
     */
    @PluginMethod
    public void getPendingShare(PluginCall call) {
        if (pendingShareData != null) {
            JSObject result = new JSObject();
            result.put("data", pendingShareData);
            pendingShareData = null;
            call.resolve(result);
        } else {
            JSObject result = new JSObject();
            result.put("data", JSObject.NULL);
            call.resolve(result);
        }
    }

    /**
     * Replace the activity intent with a clean one to prevent re-processing on config changes.
     */
    @PluginMethod
    public void clearIntent(PluginCall call) {
        Intent cleanIntent = new Intent(Intent.ACTION_MAIN);
        cleanIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        getActivity().setIntent(cleanIntent);
        call.resolve();
    }
}
