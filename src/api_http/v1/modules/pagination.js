

class Pagination {
  constructor(fetch, count, order, current_page, connection = null, list_num = 10, page_num = 4, fetch_params = null) {
    this.connection = connection;
    this.sql_query = {
      count: count,
      fetch: fetch,
      order: order
    };
    
    this.list_num = (isNaN(list_num) === false) ? list_num : 10;
    this.page_num = (isNaN(page_num) === false) ? page_num : 4;
    this.current_page = (isNaN(current_page) === false)? current_page : 1;
    this.fetch_params = fetch_params || {fetch: [], count: []};
  }
  
  async getResult() {
    return new Promise(async (resolve, reject) => {
      let [rows, fields] = [null, null];
      
      try {
        [rows, fields] = await this.connection.execute(this.sql_query['count'], this.fetch_params['count']);
        
        
      } catch(err) {
        reject(err);
      }
    });
  }
}

export default Pagination;