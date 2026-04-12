# GitHub Secrets Setup — Clipper OS CI/CD

This document explains which GitHub Secrets are required for the Android build and release workflows, and how to configure them.

---

## Required Secrets

| Secret Name | Description |
|---|---|
| `KEYSTORE_BASE64` | Android release keystore file encoded in Base64 |
| `KEYSTORE_PASSWORD` | Password for the keystore file |
| `KEY_ALIAS` | Alias of the signing key inside the keystore (default: `clipper-os`) |
| `KEY_PASSWORD` | Password for the signing key |

> **Note:** If these secrets are not configured, the CI workflow will still build the unsigned AAB and upload it as an artifact. Signing is skipped gracefully with `if: secrets.KEYSTORE_BASE64 != ''`.

---

## Step 1 — Generate the Android Keystore

If you haven't created a keystore yet, use the included script:

```bash
./scripts/generate-keystore.sh
```

The script will:
1. Prompt you for your organisation name
2. Generate `clipper-os-release.keystore` with a 2048-bit RSA key valid for 10 000 days
3. Encode the keystore to Base64 (and copy it to your clipboard on macOS)
4. Print instructions for setting the GitHub Secrets

> ⚠️ **Never commit the `.keystore` file to Git.** It is already listed in `.gitignore`.

---

## Step 2 — Add Secrets to GitHub

1. Go to your repository on GitHub:
   [https://github.com/shifu027/clipper-os-mobile/settings/secrets/actions](https://github.com/shifu027/clipper-os-mobile/settings/secrets/actions)

2. Click **New repository secret** for each of the four secrets below.

---

### `KEYSTORE_BASE64`

The keystore file encoded as a Base64 string.

Generate it manually if needed:

```bash
# macOS (copies to clipboard automatically)
base64 -i clipper-os-release.keystore | pbcopy

# Linux
base64 -w 0 clipper-os-release.keystore
```

Paste the full Base64 string as the secret value.

---

### `KEYSTORE_PASSWORD`

The password you chose when generating the keystore.

---

### `KEY_ALIAS`

The alias of the key inside the keystore. If you used the provided script, this is:

```
clipper-os
```

---

### `KEY_PASSWORD`

The password you chose for the individual key when generating the keystore.  
(This may be the same as `KEYSTORE_PASSWORD`.)

---

## Step 3 — Verify

Push a commit to `main` (or trigger the workflow manually via **Actions → Build Android → Run workflow**).

If the secrets are set correctly, the workflow will:
1. Build the web assets
2. Sync Capacitor
3. Compile the AAB with Gradle
4. Sign the AAB with `jarsigner`
5. Upload the signed `app-release.aab` as a workflow artifact

---

## Troubleshooting

| Issue | Solution |
|---|---|
| `jarsigner: error: the keystore password was incorrect` | Check `KEYSTORE_PASSWORD` value |
| `Cannot recover key` | Check `KEY_ALIAS` and `KEY_PASSWORD` |
| `base64: invalid input` | Re-encode the keystore; ensure no line breaks in the secret value |
| Workflow skips signing step | Secrets not set — add them to repository settings |

---

## Security Best Practices

- Store the original `.keystore` file in a secure location (password manager, encrypted drive)
- Back it up — losing the keystore means you cannot update your app on Google Play
- Rotate the key password periodically if your organisation's policy requires it
- Never share keystore secrets in chat, email, or issue comments
