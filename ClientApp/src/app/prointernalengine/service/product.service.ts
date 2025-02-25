import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Product } from 'src/app/prointernalengine/api/product';

@Injectable({
    providedIn: 'root',
})
export class ProductService {

    constructor(private http: HttpClient) { }

    getProductsSmall() {
      return this.http.get<any>('assets/prointernalengine/data/products-small.json')
            .toPromise()
            .then(res => res.data as Product[])
            .then(data => data);
    }

    getProducts() {
      return this.http.get<any>('assets/prointernalengine/data/products.json')
            .toPromise()
            .then(res => res.data as Product[])
            .then(data => data);
  }



    getProductsMixed() {
      return this.http.get<any>('assets/prointernalengine/data/products-mixed.json')
            .toPromise()
            .then(res => res.data as Product[])
            .then(data => data);
    }

    getProductsWithOrdersSmall() {
      return this.http.get<any>('assets/prointernalengine/data/products-orders-small.json')
            .toPromise()
            .then(res => res.data as Product[])
            .then(data => data);
    }

    getProductsWithOrdersLarge() {
      return this.http.get<any>('assets/prointernalengine/data/products-orders.json')
            .toPromise()
            .then(res => res.data as Product[])
            .then(data => data);
    }
}
