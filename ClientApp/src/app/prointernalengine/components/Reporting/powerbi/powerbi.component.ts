import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as powerbi from 'powerbi-client';
import { DataService } from 'src/app/services/data.service';
import { models } from 'powerbi-client';

@Component({
  selector: 'app-powerbi',
  standalone: true,
  imports: [],
  templateUrl: './powerbi.component.html',
  styleUrl: './powerbi.component.scss'
})



export class PowerbiComponent implements OnInit {
  @ViewChild('reportContainer', { static: true }) reportContainer!: ElementRef;

  constructor(private  dataService: DataService) { }

  ngOnInit() {

    

    this.dataService.getEmbedConfig().subscribe(config => {
      console.log('--------------------------------------------------------------')
      console.log('Available LayoutTypes:', models.LayoutType);
      const embedConfig: powerbi.IEmbedConfiguration = {
        type: 'report',
        id: config.reportId,
        embedUrl: config.embedUrl,
        accessToken: config.token,
        tokenType: powerbi.models.TokenType.Embed,

        settings: {
       //  layoutType: powerbi.models.LayoutType.Responsive, 
          panes: {
            filters: { visible: false },
            pageNavigation: { visible: true }
          }
        }
      };




      const powerbiService = new powerbi.service.Service(
        powerbi.factories.hpmFactory,
        powerbi.factories.wpmpFactory,
        powerbi.factories.routerFactory
      );

      powerbiService.embed(this.reportContainer.nativeElement, embedConfig);
    });
  }
}
