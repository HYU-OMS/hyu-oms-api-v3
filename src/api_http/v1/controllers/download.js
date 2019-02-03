import createError from 'http-errors';
import express from 'express';
import asyncify from 'express-asyncify';
import * as xlsx from 'xlsx';

const router = asyncify(express.Router());

router.get('/', async (req, res, next) => {
  if(Boolean(req.user_info) === false) {
    throw createError(401, "JWT must be provided!", {
      state: 'AUTH_HEADER_EMPTY_ERR',
      info: ['Authorization']
    });
  }

  const action_type = req.query['type'];

  if(action_type === "orders") {
    const group_id = parseInt(req.query['group_id'], 10);
    if(isNaN(group_id)) {
      throw createError(400, "'group_id' must be integer.", {
        state: 'REQUIRED_VALUE_INVALID_ERR',
        info: ['group_id']
      });
    }

    // DB Connection 생성 후 req object 에 assign.
    req.db_connection = await req.db_pool.getConnection();

    const creator_chk_query = "SELECT * FROM `members` WHERE `group_id` = ? AND `user_id` = ? AND `role` = 2";
    const creator_chk_val = [group_id, req.user_info['user_id']];
    const [creator_chk_rows, creator_chk_fields] = await req.db_connection.execute(creator_chk_query, creator_chk_val);

    if(creator_chk_rows.length === 0) {
      throw createError(403, "Not a creator of this group.", {
        state: 'ACCESS_DENIED_ERR',
        info: ['group_id']
      });
    }

    // 해당 그룹의 주문 내역 중 승인된 것만 가져온다.
    const get_orders_query = "SELECT `id` AS `order_id`, `order_menus`, `order_setmenus`, " +
      "`table_id` AS `table_name`, `total_price`, `created_at`, `updated_at` FROM `orders` " +
      "WHERE `group_id` = ? AND `status` = 1 " +
      "ORDER BY `id` ASC";
    const get_orders_val = [group_id];
    const [get_orders_rows, get_orders_fields] = await req.db_connection.execute(get_orders_query, get_orders_val);

    const order_list = JSON.parse(JSON.stringify(get_orders_rows));

    const sheet_name = "Group_" + group_id.toString();
    const download_filename = sheet_name + ".xlsx";

    const worksheet_data = xlsx.utils.json_to_sheet(order_list);
    const workbook_data = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook_data, worksheet_data, sheet_name);

    const xlsx_data = xlsx.write(workbook_data,{type: "buffer", bookType: "xlsx"});

    res.status(200);
    res.attachment(download_filename);
    res.send(xlsx_data);
  }
  else {
    throw createError(400, "Invalid value 'type' is provided.", {
      state: 'REQUIRED_VALUE_INVALID_ERR',
      info: ['type']
    });
  }
});

export default router;