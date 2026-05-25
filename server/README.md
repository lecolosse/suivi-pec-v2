# 🖥️ Serveur Backend - Gestion des Partenariats

## Prérequis

- **Node.js** >= 18
- **MySQL** >= 5.7

## Installation

### 1. Configurer la base de données

```bash
# Se connecter à MySQL
mysql -u root -p

# Exécuter le script de création des tables
source setup.sql;
```

> ⚠️ Les tables `reference_etat`, `produits` et `pharmacie` doivent **déjà exister** dans votre base.
> Le script `setup.sql` crée uniquement les tables `partenariats`, `partenariat_produits`,
> `partenariat_pharmacies` et `partenariat_quantities`.

### 2. Configurer les variables d'environnement

```bash
# Copier le fichier exemple
cp .env.example .env

# Éditer .env avec vos paramètres MySQL
# DB_HOST=localhost
# DB_USER=root
# DB_PASSWORD=votre_mot_de_passe
# DB_NAME=partenariats_db
# PORT=3001
```

### 3. Installer les dépendances

```bash
cd server
npm install
```

### 4. Démarrer le serveur

```bash
# Production
npm start

# Développement (auto-reload)
npm run dev
```

Le serveur démarre sur **http://localhost:3001**

## Endpoints API

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/health` | Vérification de l'état du serveur |
| GET | `/api/references/search?q=...` | Recherche dans `reference_etat` |
| GET | `/api/produits` | Liste des produits depuis `produits` |
| GET | `/api/pharmacies` | Liste des pharmacies depuis `pharmacie` |
| GET | `/api/partenariats` | Liste de tous les partenariats |
| GET | `/api/partenariats/:id` | Détail d'un partenariat |
| POST | `/api/partenariats` | Créer un partenariat |
| PUT | `/api/partenariats/:id/quantity` | Modifier une quantité |
| DELETE | `/api/partenariats/:id` | Supprimer un partenariat |

## Structure des tables créées

```
partenariats            → Données principales du partenariat
  ├── partenariat_produits    → Produits associés
  ├── partenariat_pharmacies  → Pharmacies associées
  └── partenariat_quantities  → Grille des quantités (pharmacie × produit × mois)
```
