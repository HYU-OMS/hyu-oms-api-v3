import mysql from "mysql2/promise";
import config from '../config';

const trigger_definer = "`" + config['v1']['mysql']['user'] + "`@`" + config['v1']['mysql']['host'] + "`";

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
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;";
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
        "  KEY `group_creator_id_idx` (`creator_id`),\n" +
        "  CONSTRAINT `group_creator_id` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;";
      await db_connection.query(groups_query);

      // Create `members` table
      const members_query = "" +
        "CREATE TABLE IF NOT EXISTS `members` (\n" +
        "  `group_id` int(11) NOT NULL,\n" +
        "  `user_id` int(11) NOT NULL,\n" +
        "  `role` int(11) NOT NULL DEFAULT '0' COMMENT '0 - Normal\\n1 - Privileged Access??\\n2 - Admin Access',\n" +
        "  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n" +
        "  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n" +
        "  PRIMARY KEY (`group_id`,`user_id`),\n" +
        "  KEY `user_id` (`user_id`),\n" +
        "  CONSTRAINT `member_group_id` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n" +
        "  CONSTRAINT `member_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;";
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
        "  KEY `group_id` (`group_id`),\n" +
        "  CONSTRAINT `menu_group_id` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;";
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
        "  KEY `group_id` (`group_id`),\n" +
        "  CONSTRAINT `setmenu_group_id` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;";
      await db_connection.query(setmenus_query);

      // Create `set_contents` table
      const set_contents_query = "" +
        "CREATE TABLE IF NOT EXISTS `set_contents` (\n" +
        "  `set_id` int(11) NOT NULL,\n" +
        "  `menu_id` int(11) NOT NULL,\n" +
        "  `amount` int(11) NOT NULL,\n" +
        "  PRIMARY KEY (`set_id`,`menu_id`),\n" +
        "  KEY `menu_id` (`menu_id`),\n" +
        "  KEY `set_id` (`set_id`),\n" +
        "  CONSTRAINT `set_menu_id` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n" +
        "  CONSTRAINT `set_target_id` FOREIGN KEY (`set_id`) REFERENCES `setmenus` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;";
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
        "  KEY `groupId_status_id` (`group_id`,`status`,`id`),\n" +
        "  KEY `user_id` (`user_id`),\n" +
        "  CONSTRAINT `order_group_id` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n" +
        "  CONSTRAINT `order_user_id` FOREIGN KEY (`user_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;";
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
        "  PRIMARY KEY (`order_id`,`menu_id`),\n" +
        "  KEY `remain_queue_chk` (`group_id`,`is_approved`,`is_delivered`),\n" +
        "  KEY `trans_menu_id_idx` (`menu_id`),\n" +
        "  CONSTRAINT `trans_group_id` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n" +
        "  CONSTRAINT `trans_menu_id` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n" +
        "  CONSTRAINT `trans_order_id` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;";
      await db_connection.query(order_transactions_query);

      db_connection.end();
    } catch(err) {
      if(db_connection !== undefined) {
        db_connection.destroy();
      }
      reject(err);
    }
  });
};

export default database_setup;