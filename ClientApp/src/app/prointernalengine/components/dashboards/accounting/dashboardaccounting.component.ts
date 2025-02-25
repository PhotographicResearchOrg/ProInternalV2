import { Component, OnInit } from '@angular/core';
import { SelectItem } from 'primeng/api';
import { Subscription, debounceTime } from 'rxjs';
import { LayoutService } from 'src/app/layout/service/app.layout.service';


interface MonthlyPayment {
    name?: string;
    amount?: number;
    paid?: boolean;
    date?: string;
}

@Component({
    templateUrl: './dashboardaccounting.component.html',
})
export class DashboardAccountingComponent implements OnInit {

    dropdownItem: SelectItem[] = [];

    selectedDropdownItem: any;

    payments: MonthlyPayment[] = [];

    visitorChart: any;

    visitorChartOptions: any;

    subscription!: Subscription;

    constructor(public layoutService: LayoutService) {
        this.subscription = this.layoutService.configUpdate$
            .pipe(debounceTime(25))
            .subscribe((config) => {
                this.initChart();
            });
    }

    ngOnInit() {
        this.dropdownItem.push({ label: 'Select One', value: null });
        this.dropdownItem.push({
            label: 'Xbox Series X',
            value: { id: 1, name: 'Xbox One', code: 'XO' },
        });
        this.dropdownItem.push({
            label: 'PlayStation 5',
            value: { id: 2, name: 'PS4', code: 'PS4' },
        });
        this.dropdownItem.push({
            label: 'Nintendo Switch',
            value: { id: 3, name: 'Wii U', code: 'WU' },
        });

        this.payments = [
            {
                name: 'Mark Klass',
                amount: 9003,
                paid: true,
                date: '06/04/2023',
            },
            {
                name: 'Mark L',
                amount: 4885.5,
                paid: true,
                date: '07/04/2023',
            },
            { name: 'Mike M', amount: 4578.2, paid: false, date: '12/04/2023' },
            {
                name: 'Nate L.',
                amount: 8825.9,
                paid: true,
                date: '07/04/2023',
            },
            {
                name: 'Shawn V',
                amount: 4880.9,
                paid: false,
                date: '12/04/2023',
            },
            {
                name: 'Lan C',
                amount: 39992.9,
                paid: false,
                date: '01/04/2024',
            },
        ];

        this.initChart();
    }

    initChart() {
        const textColor = getComputedStyle(document.body).getPropertyValue(
            '--text-color'
        );
        const primaryColor = getComputedStyle(document.body).getPropertyValue(
            '--primary-color'
        );
        const surfaceLight = getComputedStyle(document.body).getPropertyValue(
            '--surface-100'
        );

        this.visitorChart = {
            labels: [
                'Jan',
                'Feb',
                'Mar',
                'Apr',
                'May',
                'Jun',
                'July',
                'Aug',
                'Sept',
                'Oct',
                'Nov',
                'Dec',
            ],
            datasets: [
                {
                    data: [
                        600, 671, 660, 665, 700, 610, 810, 790, 710, 860, 810,
                        780,
                    ],
                    backgroundColor: primaryColor,
                    fill: true,
                    barPercentage: 0.75,
                    stepped: true,
                },
            ],
        };

        this.visitorChartOptions = {
            plugins: {
                legend: {
                    display: false,
                },
            },
            responsive: true,
            hover: {
                mode: 'index',
            },
            scales: {
                y: {
                    min: 500,
                    max: 900,
                    ticks: {
                        color: textColor,
                    },
                    grid: {
                        color: surfaceLight,
                    },
                },
                x: {
                    ticks: {
                        color: textColor,
                    },
                    grid: {
                        display: false,
                    },
                },
            },
        };
    }
}
