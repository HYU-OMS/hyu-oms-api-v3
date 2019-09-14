"use strict";

const mysql = require('mysql2/promise');
const config = require('./config');

const database_setup = async () => {
  return new Promise(async (resolve, reject) => {
    let db_connection = undefined;
    try {
      db_connection = await mysql.createConnection({
        host: config['v1']['mysql']['host'],
        database: config['v1']['mysql']['database'],
        user: config['v1']['mysql']['user'],
        password: config['v1']['mysql']['password']
      });

      // Create `users` table
      const users_query = "" +
        "CREATE TABLE IF NOT EXISTS `users` (\n" +
        "  `id` int(11) NOT NULL AUTO_INCREMENT,\n" +
        "  `name` varchar(128) NOT NULL,\n" +
        "  `fb_id` bigint(20) DEFAULT NULL,\n" +
        "  `kakao_id` bigint(20) DEFAULT NULL,\n" +
        "  `enabled` tinyint(1) NOT NULL DEFAULT '1',\n" +
        "  `auth_uuid` char(36) DEFAULT NULL,\n" +
        "  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n" +
        "  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n" +
        "  PRIMARY KEY (`id`),\n" +
        "  UNIQUE KEY `fb_id_UNIQUE` (`fb_id`),\n" +
        "  UNIQUE KEY `kakao_id_UNIQUE` (`kakao_id`)\n" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
      await db_connection.query(users_query);

      // Create `groups` table
      const groups_query = "" +
        "CREATE TABLE IF NOT EXISTS `groups` (\n" +
        "  `id` int(11) NOT NULL AUTO_INCREMENT,\n" +
        "  `name` varchar(255) NOT NULL,\n" +
        "  `creator_id` int(11) NOT NULL,\n" +
        "  `signup_code` varchar(64) DEFAULT NULL,\n" +
        "  `is_enabled` tinyint(1) NOT NULL DEFAULT '1',\n" +
        "  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n" +
        "  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n" +
        "  PRIMARY KEY (`id`),\n" +
        "  KEY `fk_groups_users1_idx` (`creator_id`),\n" +
        "  CONSTRAINT `fk_groups_users1` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
      await db_connection.query(groups_query);

      // Create `members` table
      const members_query = "" +
        "CREATE TABLE IF NOT EXISTS `members` (\n" +
        "  `group_id` int(11) NOT NULL,\n" +
        "  `user_id` int(11) NOT NULL,\n" +
        "  `role` int(11) NOT NULL DEFAULT '0' COMMENT '0 - Normal\\\\n1 - Privileged Access??\\\\n2 - Admin Access',\n" +
        "  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n" +
        "  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n" +
        "  PRIMARY KEY (`group_id`,`user_id`),\n" +
        "  KEY `fk_members_users1_idx` (`user_id`),\n" +
        "  CONSTRAINT `fk_members_groups1` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n" +
        "  CONSTRAINT `fk_members_users1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
      await db_connection.query(members_query);

      // Create `menus` table
      const menus_query = "" +
        "CREATE TABLE IF NOT EXISTS `menus` (\n" +
        "  `id` int(11) NOT NULL AUTO_INCREMENT,\n" +
        "  `name` varchar(255) NOT NULL,\n" +
        "  `price` int(11) NOT NULL,\n" +
        "  `group_id` int(11) NOT NULL,\n" +
        "  `is_enabled` tinyint(1) NOT NULL DEFAULT '1',\n" +
        "  `category` int(11) DEFAULT NULL,\n" +
        "  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n" +
        "  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n" +
        "  PRIMARY KEY (`id`),\n" +
        "  KEY `fk_menus_groups1_idx` (`group_id`),\n" +
        "  CONSTRAINT `fk_menus_groups1` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
      await db_connection.query(menus_query);

      // Create `setmenus` table
      const setmenus_query = "" +
        "CREATE TABLE IF NOT EXISTS `setmenus` (\n" +
        "  `id` int(11) NOT NULL AUTO_INCREMENT,\n" +
        "  `name` varchar(255) NOT NULL,\n" +
        "  `price` int(11) NOT NULL,\n" +
        "  `group_id` int(11) NOT NULL,\n" +
        "  `is_enabled` tinyint(1) NOT NULL DEFAULT '1',\n" +
        "  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n" +
        "  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n" +
        "  PRIMARY KEY (`id`),\n" +
        "  KEY `fk_setmenus_groups1_idx` (`group_id`),\n" +
        "  CONSTRAINT `fk_setmenus_groups1` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
      await db_connection.query(setmenus_query);

      // Create `set_contents` table
      const set_contents_query = "" +
        "CREATE TABLE IF NOT EXISTS `set_contents` (\n" +
        "  `set_id` int(11) NOT NULL,\n" +
        "  `menu_id` int(11) NOT NULL,\n" +
        "  `amount` int(11) NOT NULL,\n" +
        "  PRIMARY KEY (`set_id`,`menu_id`),\n" +
        "  KEY `set_id` (`set_id`),\n" +
        "  KEY `fk_set_contents_menus1_idx` (`menu_id`),\n" +
        "  CONSTRAINT `fk_set_contents_menus1` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n" +
        "  CONSTRAINT `fk_set_contents_setmenus1` FOREIGN KEY (`set_id`) REFERENCES `setmenus` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
      await db_connection.query(set_contents_query);

      // Create `orders` table
      const orders_query = "" +
        "CREATE TABLE IF NOT EXISTS `orders` (\n" +
        "  `id` int(11) NOT NULL AUTO_INCREMENT,\n" +
        "  `user_id` int(11) NOT NULL,\n" +
        "  `group_id` int(11) NOT NULL,\n" +
        "  `table_id` varchar(45) NOT NULL,\n" +
        "  `total_price` int(11) NOT NULL,\n" +
        "  `order_menus` text,\n" +
        "  `order_setmenus` text,\n" +
        "  `status` int(11) NOT NULL DEFAULT '0',\n" +
        "  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n" +
        "  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n" +
        "  PRIMARY KEY (`id`),\n" +
        "  KEY `fk_orders_users1_idx` (`user_id`),\n" +
        "  KEY `fk_orders_groups1_idx` (`group_id`),\n" +
        "  CONSTRAINT `fk_orders_groups1` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n" +
        "  CONSTRAINT `fk_orders_users1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
      await db_connection.query(orders_query);

      // Create `order_transactions` table
      const order_transactions_query = "" +
        "CREATE TABLE IF NOT EXISTS `order_transactions` (\n" +
        "  `order_id` int(11) NOT NULL,\n" +
        "  `menu_id` int(11) NOT NULL,\n" +
        "  `group_id` int(11) NOT NULL DEFAULT '0',\n" +
        "  `table_id` varchar(45) DEFAULT NULL,\n" +
        "  `amount` int(11) NOT NULL,\n" +
        "  `is_approved` int(11) DEFAULT NULL,\n" +
        "  `is_delivered` tinyint(1) NOT NULL DEFAULT '0',\n" +
        "  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n" +
        "  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n" +
        "  PRIMARY KEY (`order_id`,`menu_id`,`group_id`),\n" +
        "  KEY `remain_queue_chk` (`group_id`,`is_approved`,`is_delivered`),\n" +
        "  KEY `order_id_idx` (`order_id`),\n" +
        "  KEY `fk_order_transactions_menus1_idx` (`menu_id`),\n" +
        "  CONSTRAINT `fk_order_transactions_groups1` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n" +
        "  CONSTRAINT `fk_order_transactions_menus1` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n" +
        "  CONSTRAINT `fk_order_transactions_orders1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
      await db_connection.query(order_transactions_query);

      const logs_query = "" +
        "CREATE TABLE IF NOT EXISTS `logs` (\n" +
        "  `unix_time` int(11) NOT NULL,\n" +
        "  `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,\n" +
        "  `is_error` tinyint(1) NOT NULL DEFAULT '0',\n" +
        "  `headers` text COLLATE utf8mb4_unicode_ci NOT NULL,\n" +
        "  `client_ip` varchar(127) COLLATE utf8mb4_unicode_ci NOT NULL,\n" +
        "  `client_forwarded_ips` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n" +
        "  `method` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,\n" +
        "  `original_url` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,\n" +
        "  `url_query` text COLLATE utf8mb4_unicode_ci,\n" +
        "  `req_body` text COLLATE utf8mb4_unicode_ci,\n" +
        "  PRIMARY KEY (`unix_time`,`uuid`),\n" +
        "  KEY `is_error_idx` (`is_error`)\n" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
      await db_connection.query(logs_query);

      const errors_query = "" +
        "CREATE TABLE IF NOT EXISTS `errors` (\n" +
        "  `unix_time` int(11) NOT NULL,\n" +
        "  `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,\n" +
        "  `status_code` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,\n" +
        "  `message` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n" +
        "  `stack` mediumtext COLLATE utf8mb4_unicode_ci,\n" +
        "  PRIMARY KEY (`unix_time`,`uuid`)\n" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

      db_connection.end();
    } catch(err) {
      if(db_connection !== undefined) {
        db_connection.destroy();
      }
      reject(err);
    }
  });
};

module.exports = database_setup;