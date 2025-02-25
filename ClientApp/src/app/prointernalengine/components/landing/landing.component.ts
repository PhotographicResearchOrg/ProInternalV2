import { Component } from '@angular/core';

@Component({
    templateUrl: './landing.component.html',
})
export class LandingComponent { 
    scrollToElement($element: any): void {
        console.log($element);
        setTimeout(() => {
            $element.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
        }, 200);
       
    }
}
