import React, { useEffect, useState, useRef } from "react";
import { Bar, Line, Pie } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    PointElement,
    ArcElement,
} from "chart.js";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { Skeleton, Tabs } from "@chakra-ui/react";
import styles from "./style/dashboard.module.less";

ChartJS.register(CategoryScale, LinearScale, LineElement, BarElement, ArcElement, PointElement, Title, Tooltip, Legend);

const DashboardChart = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const { t } = useTranslation();
    const chartRef = useRef(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(import.meta.env.VITE_API_BASE_URL + '/dashboard');
                const result = await response.json();
                setData(result);
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return <Skeleton />;
    }

    const totalCounts = [];
    const affiliationsData = {};
    const labels = [];

    // Daten verarbeiten
    data.forEach(yearData => {
        let monthTotal = 0;
        yearData.months
            .sort((a, b) => a.month - b.month)
            .forEach(month => {
                labels.push(`${month.month}/${yearData._id}`);
                monthTotal = 0;

                month.affiliations.forEach(affiliation => {
                    if (affiliation.affiliation === "fh-swf.de") {
                        totalCounts.push(affiliation.count);
                    }

                    // Schlüsseln nach der gewünschten Form
                    const match = affiliation.affiliation.match(/[^.]+\.fh-swf\.de/);
                    if (match) {
                        if (!affiliationsData[match[0]]) {
                            affiliationsData[match[0]] = 0;
                        }
                        affiliationsData[match[0]] += affiliation.count;
                    }
                });

            });
    });

    const lineChartData = {
        labels,
        datasets: [{
            label: 'Gesamtzahl der Aufrufe (fh-swf.de)',
            data: totalCounts,
            fill: false,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
        }]
    };

    const COLORS = [
        'rgba(255, 99, 132, 0.6)',  // Soft Red
        'rgba(54, 162, 235, 0.6)',  // Soft Blue
        'rgba(255, 206, 86, 0.6)',  // Soft Yellow
        'rgba(75, 192, 192, 0.6)',  // Soft Teal
        'rgba(153, 102, 255, 0.6)', // Soft Purple
        'rgba(255, 159, 64, 0.6)',  // Soft Orange
        'rgba(201, 203, 207, 0.6)', // Soft Gray
        'rgba(255, 127, 80, 0.6)',  // Coral
        'rgba(144, 238, 144, 0.6)', // Light Green
        'rgba(173, 216, 230, 0.6)', // Light Blue
        'rgba(238, 130, 238, 0.6)', // Violet
        'rgba(240, 230, 140, 0.6)', // Khaki
        'rgba(135, 206, 250, 0.6)', // Sky Blue
        'rgba(255, 182, 193, 0.6)', // Light Pink
        'rgba(210, 105, 30, 0.6)'   // Chocolate
    ];

    const pieChartData = {
        labels: Object.keys(affiliationsData).sort((a, b) => affiliationsData[b] - affiliationsData[a]),
        datasets: [{
            label: t('requests_breakdown_label'),
            data: Object.keys(affiliationsData).sort((a, b) => affiliationsData[b] - affiliationsData[a]).map((affiliation, index) => (affiliationsData[affiliation])),
            backgroundColor: COLORS.slice(0, Object.keys(affiliationsData).length),
        }]
    };
    console.log("Pie Chart Data: ", pieChartData);



    return (
        <Tabs.Root defaultValue="total_requests" className={styles.chart}>
            <Tabs.List>
                <Tabs.Trigger value="total_requests">
                    {t('total_requests_title')}
                </Tabs.Trigger>
                <Tabs.Trigger value="requests_breakdown">
                    {t('requests_breakdown_title')}
                </Tabs.Trigger>
                <Tabs.Indicator />
            </Tabs.List>
            <Tabs.Content value="total_requests" className={styles.chart_container}>
                <Bar
                    ref={chartRef}
                    data={lineChartData}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'top',
                            },
                            title: {
                                display: true,
                                text: t('total_requests'),
                            },
                        },
                    }}
                />
            </Tabs.Content>
            <Tabs.Content value="requests_breakdown" className={styles.chart_container}>

                <Pie
                    ref={chartRef}
                    data={pieChartData}
                    options={{
                        responsive: true,
                        plugins: {
                            legend: {
                                display: false,
                            },
                            title: {
                                display: true,
                                text: t("requests_breakdown_legend"),
                            },
                            colors: {
                                enabled: false
                            }
                        },
                    }}
                />

            </Tabs.Content>
        </Tabs.Root >
    );
};

export default DashboardChart;