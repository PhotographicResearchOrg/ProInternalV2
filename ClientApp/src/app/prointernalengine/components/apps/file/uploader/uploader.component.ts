import { Component, ElementRef, QueryList, ViewChildren, Output, EventEmitter } from '@angular/core';
import { MessageService } from 'primeng/api';
import { FileAppService } from 'src/app/prointernalengine/components/apps/file/service/file.app.service';
import { DataService } from "src/app/services/data.service";
import * as XLSX from 'xlsx';
//import * as FileSaver from 'file-saver';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Input } from '@angular/core';

interface Image {
    name: string;
    objectURL: string;
}

@Component({
    selector: 'app-file-uploader',
    templateUrl: './uploader.component.html',
    providers: [MessageService]
})
export class UploaderComponent {

  @Input() mode: 'rebate' | 'patronage' = 'rebate';   

  @Output() reload: EventEmitter<void> = new EventEmitter<void>();

  reloadPage() {
    this.reload.emit();
  }



    uploadedFiles: any[] = [];
    public excelData: any[];
    @ViewChildren('buttonEl') buttonEl!: QueryList<ElementRef>;
    public excelDatas: any;
  constructor(
    private messageService: MessageService,
    private fileService: FileAppService,
    private dataService: DataService,
    private http: HttpClient
  ) { }


  onUpload(event: any) {
    const file = event.files[0];
    const reader = new FileReader();
    var filename = file.name

    reader.onload = (e: any) => {
      const data = new Uint8Array(reader.result as ArrayBuffer);
      try
      {
        const workbook = XLSX.read(data, { type: 'buffer' });
        console.log('Workbook:', workbook);

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        this.excelData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log('Excel data:', this.excelData);

        var jsonString = JSON.stringify(this.excelData);
        console.log(jsonString)
        //ExcelUpload
        const blob = new Blob([jsonString], { type: "application/json" });
        const fileData = new File([blob], filename, { type: 'application/json' })

        if (this.mode === 'rebate') {
          console.log('rebate')
          this.dataService.uploadQuarterlyFile(fileData).subscribe(event => {
            this.reload.emit();
          });
        }
        else if (this.mode === 'patronage') {
          console.log('patronage')
          this.dataService.uploadPatronageFile(fileData).subscribe(event => {
            this.reload.emit();
          });
        }
      }
      catch (error)
      {
        console.error('Error reading file:', error);
      }
    };
    reader.readAsArrayBuffer(file);
    this.reload.emit();
  }
  


    onImageMouseOver(file: Image) {
        this.buttonEl.toArray().forEach(el => {
            el.nativeElement.id === file.name ? el.nativeElement.style.display = 'flex' : null;
        })
    }

    onImageMouseLeave(file: Image) {
        this.buttonEl.toArray().forEach(el => {
            el.nativeElement.id === file.name ? el.nativeElement.style.display = 'none' : null;
        })
    }

    removeImage(event: Event, file: any) {
        event.stopPropagation();
        this.uploadedFiles = this.uploadedFiles.filter(i => i !== file);
    }

}
