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
                const response = await fetch(import.meta.env.VITE_DASHBOARD_URL);
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
            borderColor: 'rgba(30, 136, 229, 0.8)',
            backgroundColor: 'rgba(30, 136, 229, 0.6)',
        }]
    };

    const COLORS = [

        'rgba(255, 87, 34, 0.8)',
        'rgba(33, 150, 243, 0.8)',
        'rgba(76, 175, 80, 0.8)',
        'rgba(255, 193, 7, 0.8)',
        'rgba(156, 39, 176, 0.8)',
        'rgba(233, 30, 99, 0.8)',
        'rgba(0, 188, 212, 0.8)',
        'rgba(255, 152, 0, 0.8)',
        'rgba(96, 125, 139, 0.8)',
        'rgba(255, 235, 59, 0.8)',
        'rgba(0, 150, 136, 0.8)',
        'rgba(158, 158, 158, 0.8)',
        'rgba(240, 98, 146, 0.8)',
        'rgba(48, 63, 159, 0.8)',
        'rgba(30, 136, 229, 0.8)'

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