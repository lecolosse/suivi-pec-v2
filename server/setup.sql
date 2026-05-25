CREATE DATABASE IF NOT EXISTS partenariats_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE partenariats_db;

-- ==========================================================
-- Partenariats principaux (ajout de created_by pour filtrer par utilisateur)
-- ==========================================================
CREATE TABLE IF NOT EXISTS partenariats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  annee VARCHAR(10) DEFAULT NULL,
  reference VARCHAR(100) DEFAULT NULL,
  type_manifestation VARCHAR(100) DEFAULT NULL,
  manifestation TEXT DEFAULT NULL,
  start_month VARCHAR(10) DEFAULT NULL,
  end_month VARCHAR(10) DEFAULT NULL,
  follow_up_end_month VARCHAR(10) DEFAULT NULL,
  prospect VARCHAR(100) DEFAULT NULL,
  supervisor VARCHAR(100) DEFAULT NULL,
  delegates VARCHAR(200) DEFAULT NULL,
  budget DECIMAL(15,2) DEFAULT 0.00,
  potential_pharmacies DECIMAL(5,2) DEFAULT 0.00,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS partenariat_produits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  partenariat_id INT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  boxes INT DEFAULT 0,
  FOREIGN KEY (partenariat_id) REFERENCES partenariats(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS partenariat_pharmacies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  partenariat_id INT NOT NULL,
  pharmacy_name VARCHAR(255) NOT NULL,
  FOREIGN KEY (partenariat_id) REFERENCES partenariats(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS partenariat_quantities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  partenariat_id INT NOT NULL,
  pharmacy_name VARCHAR(255) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  month VARCHAR(10) NOT NULL,
  quantity INT DEFAULT 0,
  FOREIGN KEY (partenariat_id) REFERENCES partenariats(id) ON DELETE CASCADE,
  UNIQUE KEY uq_pq (partenariat_id, pharmacy_name, product_name, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
