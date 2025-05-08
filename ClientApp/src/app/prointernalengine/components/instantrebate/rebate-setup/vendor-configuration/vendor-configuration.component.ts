import { Component } from '@angular/core';
import { DataService } from "src/app/services/data.service";
import { ParentCompany, RebateVendor } from "src/app/models/Dashboard/InstantRebate"


@Component({
  selector: 'app-vendor-configuration',
  templateUrl: './vendor-configuration.component.html',
  styleUrls: ['./vendor-configuration.component.scss']
})



export class VendorConfigurationComponent {

  constructor(private dataService: DataService) { }



  ngOnInit() {

    this.loadVendors();

    this.dataService.getAllParentCompanies().subscribe((companies) => {
      this.parentCompanies = companies;
    });
  }

  displayParentDialog = false;
  newParentName = '';

  selectedParentIndex: number | null = null;
  parentCompanies: ParentCompany[] = [];
  selectedParentCompany: ParentCompany | null = null;
  parentConfirmationMessage: string | null = null;

  parentActionMessage: string | null = null;
  parentActionIcon: string = 'pi-check-circle';
  parentActionColor: string = 'text-success';
  rebatevendors: RebateVendor[] = [];

  showIR = true;
  showActive = true;
  vendorSearchTerm = '';
  filteredVendors: RebateVendor[] = [];

  vendorActionMessage: string | null = null;
  vendorActionIcon: string = 'pi-check-circle';
  vendorActionColor: string = 'text-success';




  filterVendors() {
    const term = this.vendorSearchTerm.toLowerCase();
    this.filteredVendors = this.rebatevendors.filter(v =>
      (this.showIR ? v.isInstantRebate : !v.isInstantRebate) &&
      (this.showActive ? v.active : !v.active) &&
      (
        v.vendorName.toLowerCase().includes(term) ||
        v.parentCompany?.toLowerCase().includes(term) ||
        v.apmstid?.toLowerCase().includes(term)
      )
    );
  }



  showVendorSuccess(message: string) {
    this.vendorActionMessage = message;
    this.vendorActionIcon = 'pi-check-circle';
    this.vendorActionColor = 'text-success';
    setTimeout(() => this.vendorActionMessage = null, 4000);
  }

  loadVendors(): void {
    this.dataService.getAllRebateVendors().subscribe((res) => {
      console.log('Vendor response:', res); // Check what structure you're getting
      this.rebatevendors = res;
      this.filterVendors();
    });
  }


  displayDialog = false;
  formVendor: any = {};
  selectedVendor: any = null;


  showParentSuccess(message: string) {
    this.parentActionMessage = message;
    setTimeout(() => this.parentActionMessage = null, 3500);
  }



  openParentDialog() {
    this.displayParentDialog = true;
  }


  addParentCompany() {
    const trimmed = this.newParentName.trim();
    const exists = this.parentCompanies.some(pc => pc.companyName.toLowerCase() === trimmed.toLowerCase());

    if (trimmed && !exists) {



      const newCompany: ParentCompany = {
        id: 0,
        companyName: trimmed,
        imageUrl: this.selectedParentCompany?.imageUrl || null,
        active: true
      };

      this.dataService.addParentCompany(newCompany).subscribe((created) => {

        this.loadParentCompanies(); // re-fetch sorted list

        this.resetParentForm();
        this.showParentSuccess(`${created.companyName} was successfully added.`);
      });

    }
  }

  loadParentCompanies() {
    this.dataService.getAllParentCompanies().subscribe(data => {
      this.parentCompanies = data.sort((a, b) =>
        a.companyName.localeCompare(b.companyName)
      );
    });
  }

  updateParentCompany() {
    const trimmed = this.newParentName.trim();
    if (trimmed && this.selectedParentIndex !== null && this.selectedParentCompany) {
      const company = this.parentCompanies[this.selectedParentIndex];
      const updatedCompany: ParentCompany = {
        ...company,
        companyName: trimmed,
        imageUrl: this.selectedParentCompany.imageUrl || null
      };

      this.dataService.updateParentCompany(updatedCompany).subscribe(() => {
        this.parentCompanies[this.selectedParentIndex!] = updatedCompany;
        this.resetParentForm();
        this.showParentSuccess(`${updatedCompany.companyName} was updated.`);
      });
    }
  }



onParentImageUpload(event: any) {
  const file = event.target.files[0];
  if (file && this.selectedParentCompany) {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('location', 'parents');
    this.dataService.uploadParentImage(formData).subscribe((imageUrl: string) => {
    //this.dataService.uploadParentImage(formData).subscribe((relativeUrl: string) => {
      //const baseUrl = 'https://members.promaster.com'; // Replace with environment variable for production
      //this.selectedParentCompany!.imageUrl = `${baseUrl}${relativeUrl}`;
      this.selectedParentCompany!.imageUrl = imageUrl; // <-- This needs to change
      this.showParentSuccess(`Logo uploaded successfully.`);
    });
  }
}


  deleteParentCompany(index: number) {
    const company = this.parentCompanies[index];
    if (!company?.id) return;

    this.dataService.deleteParentCompany(company.id).subscribe(() => {
      this.parentCompanies.splice(index, 1);
      if (this.selectedParentIndex === index) {
        this.resetParentForm();
      }
      this.showParentSuccess(`${company.companyName} was deleted successfully.`);
    });
  }


  cancelEditParent() {
    this.resetParentForm();
  }



  editParentCompany(index: number) {
    this.selectedParentIndex = index;
    this.selectedParentCompany = this.parentCompanies[index];
    this.newParentName = this.selectedParentCompany.companyName; 
  }




  resetParentForm() {
    this.newParentName = '';
    this.selectedParentIndex = null;
  }


  get activeCount() {
    return this.rebatevendors.filter(v => v.active).length;
  }

  get instantRebateCount() {
    return this.rebatevendors.filter(v => v.isInstantRebate).length;
  }

  get priceProtectionCount() {
    return this.rebatevendors.filter(v => !v.isInstantRebate).length;
  }

  openDialog() {
    this.formVendor = {

      active: true,              // Default to Active
      isInstantRebate: true, // Default to Instant Rebate (not price protection)

    };
    this.selectedVendor = null;
    this.displayDialog = true;
  }


  editVendor(vendor: any) {
    this.formVendor = { ...vendor };
    this.selectedVendor = vendor;
    this.displayDialog = true;
  }



  //This is the save function. 
  saveVendor() {

    const selectedParent = this.parentCompanies.find(pc => pc.companyName === this.formVendor.parentCompany?.companyName);


    const vendorToSave = {
      ...this.formVendor,
      parentCompany: selectedParent?.companyName || '',
      parentCompanyId: selectedParent?.id || null,
      imageUrl: this.formVendor.imageUrl,
      active: Boolean(this.formVendor.active),
      isPriceProtection: this.formVendor.isPriceProtection,
      isInstantRebate: !this.formVendor.isPriceProtection  
      };


    console.log(this.formVendor)

    if (this.selectedVendor && this.selectedVendor.id) {
      // UPDATE
      this.dataService.updateRebateVendor(vendorToSave).subscribe(() => {
        Object.assign(this.selectedVendor, vendorToSave);
        this.showVendorSuccess(`${vendorToSave.vendorName} was updated successfully.`);
        this.loadVendors();  // 🔄 Refresh the table

        setTimeout(() => {
          this.displayDialog = false;
          this.resetForm();
        }, 2000);
      });
    } else {
      // ADD
      this.dataService.addRebateVendor(vendorToSave).subscribe((createdVendor: RebateVendor) => {
        this.rebatevendors.push(createdVendor);
        this.filterVendors();
        this.loadVendors();  // 🔄 Refresh the table
        this.showVendorSuccess(`${createdVendor.vendorName} was added successfully.`);
        setTimeout(() => {
          this.displayDialog = false;
          this.resetForm();
        }, 2000);
      });
    }
  }



  resetForm() {
    this.formVendor = {};
    this.selectedVendor = null;
  }

  onImageUpload(event: any) {
    const file = event.target.files[0];
    if (file) {
      const formData = new FormData();

      formData.append('file', file, file.name);

      // Decide location based on context
      const isParentUpload = !!this.selectedParentCompany;
      const uploadLocation = isParentUpload ? 'ParentRebateVendor' : 'RebateVendor';
      formData.append('location', uploadLocation);


      this.dataService.uploadParentImage(formData).subscribe((imageUrl: string) => {
        if (isParentUpload) {
          this.selectedParentCompany!.imageUrl = imageUrl;
          this.showParentSuccess('Parent logo uploaded successfully.');
        } else {
          this.formVendor.imageUrl = imageUrl;
          this.showParentSuccess('Vendor logo uploaded successfully.');
        }
      });
    }
  }



  deleteVendor(id: number) {
    this.dataService.deleteRebateVendor(id).subscribe(() => {
      this.rebatevendors = this.rebatevendors.filter(v => v.id !== id);
      this.filterVendors();
    });
  }


}
