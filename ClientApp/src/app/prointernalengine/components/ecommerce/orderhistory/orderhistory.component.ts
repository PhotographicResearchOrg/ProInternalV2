import { Component } from '@angular/core';

@Component({
    templateUrl: './orderhistory.component.html'
})
export class OrderHistoryComponent {

    orders = [
        {
            orderNumber: '45123',
            orderDate: '7 February 2023',
            amount: '$123.00',
              products: [
                  {
                      name: '	MB PL-RC-1 | Pro Light camera element cover RC-1 for PDW-750,PXW-X500',
                      color: 'Quantity: 2',
                      size: 'Stock: Yes | Product: 7511 | Cost:$158.42 ',
                      price: '$158.42',
                      deliveryDate: 'Special Buy one get 1 Lens Cap February 2023',
                      image: 'http://images.promaster.com/7511.jpg'
                },

                {
                    name: '10X Dome Loupe',
                    color: 'Quantity: 2',
                    size: 'Product: 6836 | Cost:$29.42 ',
                    price: '$50',
                    deliveryDate: 'In Stock',
                    image: 'http://images.promaster.com/6836.jpg'
                },
                {
                    name: '	Instax Mini Contact Sheet Film 1-Pack',
                    color: 'Quantity: 1',
                    size: 'Stock: Yes | Product: 6836 | Cost:$29.10 ',
                    price: '$63',
                    deliveryDate: 'In Stock',
                  image: 'http://images.promaster.com/61306.jpg'
                },
            ]
      },


      {
        orderNumber: '45123',
        orderDate: '7 February 2023',
        amount: '$123.00',
        products: [
          {
            name: '	MB PL-RC-1 | Pro Light camera element cover RC-1 for PDW-750,PXW-X500',
            color: 'Quantity: 2',
            size: 'Stock: Yes | Product: 7511 | Cost:$158.42 ',
            price: '$158.42',
            deliveryDate: 'Special Buy one get 1 Lens Cap February 2023',
            image: 'http://images.promaster.com/7511.jpg'
          },

          {
            name: '10X Dome Loupe',
            color: 'Quantity: 2',
            size: 'Product: 6836 | Cost:$29.42 ',
            price: '$50',
            deliveryDate: 'In Stock',
            image: 'http://images.promaster.com/6836.jpg'
          },
          {
            name: '	Instax Mini Contact Sheet Film 1-Pack',
            color: 'Quantity: 1',
            size: 'Stock: Yes | Product: 6836 | Cost:$29.10 ',
            price: '$63',
            deliveryDate: 'In Stock',
            image: 'http://images.promaster.com/61306.jpg'
          },
        ]
      },
    ];

}
