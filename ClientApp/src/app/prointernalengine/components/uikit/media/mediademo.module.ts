import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediademoComponent } from './mediademo.component';
import { MediademoRoutingModule } from './mediademo-routing.module';
import { ButtonModule } from 'primeng/button';
import { ImageModule } from 'primeng/image';
import { GalleriaModule } from 'primeng/galleria';
import { CarouselModule } from 'primeng/carousel';

@NgModule({
	imports: [
		CommonModule,
		MediademoRoutingModule,
		ButtonModule,
		ImageModule,
		GalleriaModule,
		CarouselModule
	],
	declarations: [MediademoComponent]
})
export class MediademoModule { }
