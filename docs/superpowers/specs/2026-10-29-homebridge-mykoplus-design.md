# Spécification Technique : Plugin Homebridge Myko+ (`homebridge-mykoplus`)

**Date :** 2026-10-29  
**Statut :** Validé  
**Auteur :** Antigravity & nitatemic  

---

## 1. Contexte & Objectifs

L'objectif est de développer un plugin Homebridge natif TypeScript (`homebridge-mykoplus`) permettant de contrôler les appareils connectés de l'écosystème **Myko+** (Kingfisher : Castorama, B&Q, Brico Dépôt, Screwfix) directement depuis Apple Maison (HomeKit).

### Périmètre initial
* **Cible prioritaire :** Prises connectées Myko+ (3 prises présentes sur le compte de test).
* **Fonctionnalités :**
  * Authentification automatique auprès de l'API Cloud Myko+.
  * Découverte dynamique des appareils enregistrés sur le compte utilisateur.
  * Pilotage On/Off des prises connectées (`Service.Outlet`).
  * Lecture de l'état réel et synchronisation bidirectionnelle via polling régulier.
  * Mises à jour optimistes pour réactivité immédiate dans l'application Maison.
  * Architecture modulaire permettant l'ajout futur d'autres catégories d'appareils (ampoules, radiateurs, climatiseurs).

---

## 2. Architecture Logicielle

Le plugin adopte le modèle officiel **Dynamic Platform Plugin** de Homebridge.

```
homebridge-mykoplus/
├── src/
│   ├── index.ts                 # Enregistrement de la plateforme auprès de Homebridge
│   ├── settings.ts              # Constantes (PLATFORM_NAME, PLUGIN_NAME)
│   ├── platform.ts              # MykoPlusPlatform (DynamicPlatformPlugin, gestion du cycle de vie)
│   ├── platformAccessory.ts     # Wrapper générique d'accessoire Homebridge
│   ├── accessories/
│   │   └── outletAccessory.ts   # Gestionnaire d'accessoire spécifique aux prises (Service.Outlet)
│   └── api/
│       ├── client.ts            # Client API Myko+ autonome (authentification, session, requêtes)
│       └── types.ts             # Typages TypeScript (utilisateurs, appareils, payloads)
├── scripts/
│   └── test-auth.ts             # Script CLI de test et validation de l'API Myko+ en isolation
├── config.schema.json           # Schéma de configuration pour l'interface web Homebridge
├── package.json                 # Métadonnées, dépendances et scripts
├── tsconfig.json                # Configuration du compilateur TypeScript
└── .env                         # Credentials locaux (strictement ignoré par Git)
```

### Découplage API / Homebridge
* La couche `src/api/` est totalement indépendante du runtime Homebridge.
* Elle peut être exécutée et testée via des scripts Node.js autonomes avant toute intégration HomeKit.

---

## 3. Spécification de l'API Myko+ & Flux de Données

### 3.1 Authentification & Sessions
* Authentification basée sur les identifiants utilisateur (`MYKOPLUS_MAIL`, `MYKOPLUS_PASSWORD`).
* Récupération des jetons de session (Access Token JWT et Refresh Token).
* Maintien de session en mémoire : rafraîchissement transparent en cas d'expiration ou de statut `401 Unauthorized`.
* Pas de persistance sur disque des jetons pour éviter les risques de sécurité.

### 3.2 Découverte & Modèle des Appareils
* Récupération de l'arborescence des foyers/maisons et de la liste des appareils associés.
* Filtrage et typage des prises connectées.
* Extraction des métadonnées : UUID de l'appareil, nom personnalisé, modèle, statut de connectivité (en ligne/hors ligne), état de l'alimentation (`power`: on/off).

### 3.3 Commandes & Polling
* **Commandes HomeKit :**
  * Lors d'une action utilisateur dans Maison (HomeKit `SET Characteristic.On`), le plugin effectue une **mise à jour optimiste** de l'état local pour un feedback instantané.
  * La commande est expédiée immédiatement via une requête HTTP vers l'API Myko+.
  * Si la requête échoue, l'état local revient à la valeur précédente et un avertissement est logué.
* **Polling de synchronisation :**
  * Interrogation périodique de l'état des appareils (intervalle par défaut : 30 secondes, configurable).
  * Notification à HomeKit en cas de changement d'état provoqué en dehors de HomeKit (ex: app Myko+ ou bouton physique sur la prise).

---

## 4. Sécurité & Confidentialité des Données

* **Gestion des secrets :**
  * Aucun identifiant ou mot de passe ne doit être consigné dans le dépôt Git.
  * Le fichier `.env` est exclu via `.gitignore`.
  * Possibilité d'exécuter les tests via l'utilitaire 1Password (`op run -- ...`).
* **Masquage dans les logs :**
  * Les informations sensibles (tokens d'authentification, mot de passe) sont masquées dans tous les logs générés par le plugin (`[REDACTED]`).

---

## 5. Gestion des Erreurs & Résilience

* **Perte de connexion Cloud :**
  * En cas d'indisponibilité du cloud Myko+, le plugin ne doit jamais provoquer le crash du processus Homebridge.
  * Les accessoires HomeKit restent accessibles avec leur dernier état connu ou sont signalés comme indisponibles (`HAPStatus.SERVICE_COMMUNICATION_FAILURE`).
* **Backoff exponentiel :**
  * En cas d'erreurs réseau consécutives lors du polling, l'intervalle est augmenté progressivement pour soulager les serveurs distants.

---

## 6. Plan de Test & Validation

1. **Validation API (Phase isolée) :**
   * Exécution de `scripts/test-auth.ts` avec les credentials de test.
   * Vérification du succès de l'authentification et de la détection des 3 prises connectées.
   * Test d'un cycle de commutation (allumage / extinction) sur une prise cible pour confirmer le payload de commande.
2. **Tests Unitaires & Linting :**
   * Validation de la compilation TypeScript (`tsc --noEmit`).
   * Tests des sérialiseurs/désérialiseurs de payloads API.
3. **Validation Homebridge :**
   * Démarrage d'une instance Homebridge locale pointant vers le plugin compilé.
   * Contrôle des 3 prises depuis l'interface Homebridge UI et HomeKit.
