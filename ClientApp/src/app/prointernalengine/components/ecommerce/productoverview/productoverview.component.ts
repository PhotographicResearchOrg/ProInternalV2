import { Component, OnInit } from '@angular/core';



@Component({
    templateUrl: './productoverview.component.html',
})

export class ProductOverviewComponent implements OnInit {

    color: string = 'bluegray';

    size: string = 'M';

    liked: boolean = false;

    images: string[] = [];

    selectedImageIndex: number = 0;



    quantity: number = 1;
          
    ngOnInit(): void {
      this.images = [
          'http://images.promaster.com/3333_1.jpg',
          'http://images.promaster.com/3333_2.jpg',
          'http://images.promaster.com/3333_2.jpg',
          'http://images.promaster.com/3333_2.jpg'
      ];
    }
}
