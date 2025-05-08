import { Component, OnInit, Inject } from '@angular/core';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { FileUploadModule } from 'primeng/fileupload';
import { DropdownModule } from 'primeng/dropdown';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { TagModule } from 'primeng/tag';
import { FormsModule } from '@angular/forms';
import { VendorConfigurationComponent } from 'src/app/prointernalengine/components/instantrebate/rebate-setup/vendor-configuration/vendor-configuration.component'
import { CardModule } from 'primeng/card';
import { TabViewModule } from 'primeng/tabview';

import { Folder } from 'src/app/prointernalengine/api/folder';
import { File } from 'src/app/prointernalengine/api/file';
import { Metric } from 'src/app/prointernalengine/api/metric';
import { FileAppService } from 'src/app/prointernalengine/components/apps/file/service/file.app.service';
import { MenuItem } from 'primeng/api';
import { AppConfig, LayoutService } from 'src/app/layout/service/app.layout.service';
import { Subscription, debounceTime } from 'rxjs';
import { DataService } from "src/app/services/data.service";
import { Router } from "@angular/router";
import { HttpClient } from '@angular/common/http';
import * as XLSX from 'xlsx';



@Component({
  selector: 'app-rebate-setup',
  templateUrl: './rebate-setup.component.html',
  styleUrl: './rebate-setup.component.scss'
})
export class RebateSetupComponent {


}
