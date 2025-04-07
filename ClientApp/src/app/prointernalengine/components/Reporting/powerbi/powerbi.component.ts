import { Component, ElementRef, OnInit, ViewChild, HostListener } from '@angular/core';
import * as powerbi from 'powerbi-client';
import { DataService } from 'src/app/services/data.service';
import { models, Report } from 'powerbi-client';

@Component({
  selector: 'app-powerbi',
  standalone: true,
  imports: [],
  templateUrl: './powerbi.component.html',
  styleUrl: './powerbi.component.scss'
})
export class PowerbiComponent implements OnInit {
  @ViewChild('reportContainer', { static: true }) reportContainer!: ElementRef;
  report!: Report; 

  constructor(private dataService: DataService) { }

  ngOnInit() {
    this.dataService.getEmbedConfig().subscribe(config => {
      const embedConfig: powerbi.IEmbedConfiguration = {
        type: 'dashboard',
        id: config.reportId,
        embedUrl: config.embedUrl,
        accessToken: config.token,
        tokenType: models.TokenType.Embed,
        viewMode: models.ViewMode.View,
        permissions: models.Permissions.All,
        settings: {
          layoutType: models.LayoutType.Master,
          navContentPaneEnabled: true,
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

    
      this.report = powerbiService.embed(
        this.reportContainer.nativeElement,
        embedConfig
      ) as Report;
    });
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    if (this.report) {
      (this.report as any).resize();
    }
  }

}
