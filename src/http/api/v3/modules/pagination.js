"use strict";

class Pagination {
  constructor(fetch_q, count_q, order_q, current_page, connection, fetch_params = null, list_num = 10, page_num = 4) {
    this.connection = connection;
    this.sql_query = {
      count: count_q,
      fetch: fetch_q,
      order: order_q
    };
    
    this.list_num = (isNaN(list_num) === false) ? parseInt(list_num.toString(), 10) : 10;
    this.page_num = (isNaN(page_num) === false) ? parseInt(page_num.toString(), 10) : 4;
    this.current_page = (isNaN(current_page) === false)? parseInt(current_page.toString(), 10) : 1;
    this.fetch_params = fetch_params || {fetch: [], count: []};
  }
  
  async getResult() {
    return new Promise(async (resolve, reject) => {
      let [rows, fields] = [null, null];
      
      try {
        [rows, fields] = await this.connection.execute(this.sql_query['count'], this.fetch_params['count']);

        const total_cnt = parseInt((rows[0]['cnt']).toString(), 10);
        const total_page = parseInt(Math.ceil(parseFloat(total_cnt.toString()) / parseFloat(this.list_num.toString())).toString(), 10);
        const current_page = Math.max(1, Math.min(this.current_page, total_page));
        const current_block = parseInt(Math.ceil(parseFloat(current_page.toString()) / parseFloat(this.page_num.toString())).toString(), 10);
        const start_page = (current_block - 1) * this.page_num + 1;
        const end_page = current_block * this.page_num;
        const total_block = parseInt(Math.ceil(parseFloat(total_page.toString()) / parseFloat(this.page_num.toString())).toString(), 10);
        const start_num = (current_page - 1) * this.list_num;

        const list_query_str = this.sql_query['fetch'] + " "  + this.sql_query['order'] +
          " LIMIT " + start_num.toString() + ", " + this.list_num.toString();

        [rows, fields] = await this.connection.execute(list_query_str, this.fetch_params['fetch']);
        const result = JSON.parse(JSON.stringify(rows));

        const paging = [];

        if(total_page !== 1) {
          if(start_page > 1) {
            paging.push({'num': start_page - 1, 'text': '«', 'current': false});
          }

          let idx = start_page;
          while(idx <= end_page && idx <= total_page) {
            paging.push({'num': idx, 'text': idx, 'current': (idx === current_page)});
            idx += 1;
          }

          if(current_block < total_block) {
            paging.push({'num': end_page + 1, 'text': '»', 'current': false});
          }
        }

        resolve([result, paging]);
      } catch(err) {
        reject(err);
      }
    });
  }
}

module.exports = Pagination;