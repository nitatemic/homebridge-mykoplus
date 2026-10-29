<p align="center">
  <a href="https://homebridge.io"><img src="https://raw.githubusercontent.com/homebridge/branding/master/logos/homebridge-wordmark-logo-vertical.png" height="200" alt="Homebridge"></a>
</p>

# homebridge-mykoplus

[![npm version](https://badge.fury.io/js/homebridge-mykoplus.svg)](https://badge.fury.io/js/homebridge-mykoplus)
[![Node.js CI](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

Native **Homebridge dynamic platform plugin** for **Myko+** smart home devices (Kingfisher ecosystem: **Castorama**, **B&Q**, **Brico Dépôt**, **Screwfix**) in Apple HomeKit.

---

## 🌟 Why homebridge-mykoplus?

Most Kingfisher connected devices use the **Myko+** platform. Until now, integrating them into Apple HomeKit often required resetting and repairing every device onto generic Tuya or Smart Life mobile applications, breaking native schedules and Kingfisher app features.

**homebridge-mykoplus** provides a **native, direct cloud integration**:
- **No re-pairing required:** Keep your plugs paired in your official Myko+ app.
- **Zero hardware modifications:** Connects directly via the official Myko+ cloud API.
- **Coexists peacefully:** Both the Myko+ app and Apple Home can be used simultaneously with real-time state synchronization.

---

## 🔌 Supported Devices

| Device Category | Supported | HomeKit Service | Characteristics |
| :--- | :---: | :--- | :--- |
| **Smart Plugs / Sockets** *(Prises connectées)* | ✅ | `Service.Outlet` | `On`, `OutletInUse` |
| **Heaters / Radiators** | ⏳ Roadmap | `Service.HeaterCooler` / `Thermostat` | *Planned in modular architecture* |
| **Smart Bulbs & Lighting** | ⏳ Roadmap | `Service.Lightbulb` | *Planned in modular architecture* |

> Compatible with smart plugs sold across Kingfisher retail brands including **Castorama** (Diall, Blyss), **B&Q**, **Brico Dépôt**, and **Screwfix**.

---

## ✨ Features

- **Dynamic Device Discovery:** Automatically discovers all registered plugs across your homes on startup.
- **Optimistic Updates:** Instant toggle feedback in Apple Home. Plugs switch immediately in the UI while dispatching commands asynchronously, automatically rolling back and alerting you if a network error occurs.
- **Bidirectional Polling & State Sync:** Regularly polls device status (default: 30s) to keep Apple HomeKit synchronized when plugs are toggled physically on the device or via the Myko+ mobile app.
- **Resilient Polling with Exponential Backoff:** Gracefully handles internet outages or cloud hiccups by progressively backing off requests instead of hammering the servers, recovering automatically once the connection returns.
- **Cached Accessory Persistence:** Restores previously paired accessories immediately upon Homebridge reboot and cleans up obsolete accessories automatically.
- **Security & Privacy First:**
  - Authentication tokens are maintained purely in-memory (never written to disk).
  - All log entries automatically sanitize and mask passwords, JWT tokens, and credentials (`[REDACTED]`).
- **Homebridge UI Support:** Fully integrated with Homebridge Config UI X with a clean configuration form.

---

## 📋 Compatibility & Requirements

- **Node.js:** `>= 18.0.0` (fully compatible and tested on Node 20, 22, 24, and 26).
- **Homebridge:** `>= 1.6.0` (compatible with Homebridge v1.x and v2.x).
- An active **Myko+** account (email and password).

---

## 🚀 Installation

### Option 1: Via Homebridge Config UI X (Recommended)

1. Open your **Homebridge Config UI X** dashboard.
2. Navigate to the **Plugins** tab.
3. Search for `homebridge-mykoplus`.
4. Click **Install**.
5. Fill in your Myko+ account email and password, then save and restart Homebridge.

### Option 2: Via Command Line

```bash
npm install -g homebridge-mykoplus
```

---

## ⚙️ Configuration

### Graphical Configuration (Config UI X)

In the plugin settings screen in Homebridge Config UI X, configure:
- **Myko+ Account Email** (required)
- **Myko+ Account Password** (required)
- **Polling Interval (seconds)** (optional, default: `30`, min: `5`, max: `300`)

---

### Manual Configuration (`config.json`)

Add the platform block to the `platforms` array in your Homebridge `config.json`:

```json
{
  "platforms": [
    {
      "platform": "MykoPlusPlatform",
      "name": "MykoPlus",
      "email": "your-email@example.com",
      "password": "your-secret-password",
      "pollInterval": 30
    }
  ]
}
```

### Configuration Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :---: | :---: | :---: | :--- |
| `platform` | string | **Yes** | — | Must be `"MykoPlusPlatform"`. |
| `name` | string | No | `"MykoPlus"` | Platform display name in Homebridge logs. |
| `email` | string | **Yes** | — | Your Myko+ registered email address. |
| `password` | string | **Yes** | — | Your Myko+ account password. |
| `pollInterval` | integer | No | `30` | Device status refresh rate in seconds (min: `5`, max: `300`). |

---

## 🛡️ Security & Privacy

We treat security and privacy with top priority:

1. **Direct Encrypted HTTPS:** All communication is routed exclusively to the official Myko+ cloud API endpoints via TLS/HTTPS.
2. **No Data Collection:** This plugin does not collect telemetry, track usage, or communicate with any third-party servers.
3. **Volatile Tokens:** Access and refresh tokens are kept strictly in-memory during execution and refreshed transparently. No credentials or tokens are ever written to your local disk or Homebridge storage cache.
4. **Log Redaction:** Sensitive values (passwords, JWT authorization headers, session tokens) are automatically filtered and redacted with `[REDACTED]` before printing to Homebridge console logs.

---

## 🔧 Troubleshooting

### Plugs do not appear in Apple Home
1. Check that your credentials in the plugin configuration match the ones used in the official Myko+ mobile app.
2. Ensure your smart plugs are online in the Myko+ app.
3. Review Homebridge logs for discovery messages (`Found X Myko+ device(s)`).

### Status changes are slow to reflect when toggled physically
By default, the plugin polls for cloud updates every 30 seconds. You can lower the `pollInterval` in settings (e.g. to `15` or `10` seconds) for faster updates. Keep in mind that setting the interval too low may cause rate limiting on poor connections.

### Homebridge logs show network warnings
If your internet connection drops or the Myko+ cloud experiences intermittent latency, the plugin automatically enters an exponential backoff state to protect server stability, then resumes normal polling as soon as connectivity is restored.

### Enabling Debug Logs
Run Homebridge in debug mode to see verbose HTTP exchanges (with tokens safely sanitized):
```bash
homebridge -D
```

---

## 🛠️ Development & Testing

Contributions, bug reports, and pull requests are welcome!

```bash
# Clone repository
git clone https://github.com/nitatemic/homebridge-mykoplus.git
cd homebridge-mykoplus

# Install dependencies
npm install

# Compile TypeScript
npm run build

# Run unit and integration tests
npm test

# Test Myko+ authentication with local credentials
npm run test:auth
```

---

## 📄 License

Distributed under the **Apache-2.0 License**. See [LICENSE](LICENSE) for more information.

---

## ⚖️ Disclaimer

This is an independent open-source community project. It is not affiliated with, maintained, authorized, or endorsed by **Kingfisher plc**, **Castorama**, **B&Q**, **Brico Dépôt**, **Screwfix**, or **Myko+**. All product and company names are trademarks™ or registered® trademarks of their respective holders.
