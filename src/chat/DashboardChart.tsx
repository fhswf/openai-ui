import React, { useEffect, useState, useRef } from "react";
import { Bar, Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    PointElement
} from "chart.js";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@chakra-ui/react";

ChartJS.register(CategoryScale, LinearScale, LineElement, BarElement, PointElement, Title, Tooltip, Legend);

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
    data.forEach((yearData, yearIndex) => {
        let monthTotal = 0;
        yearData.months
            .sort((a, b) => a.month - b.month)
            .forEach(month => {
                labels.push(`${month.month}/${yearData._id}`);


                month.affiliations.forEach(affiliation => {
                    if (affiliation.affiliation === "fh-swf.de") {
                        totalCounts.push(affiliation.count);
                    }

                    // Schlüsseln nach der gewünschten Form
                    const match = affiliation.affiliation.match(/[^.]+\.fh-swf\.de/);
                    if (match) {
                        if (!affiliationsData[match[0]]) {
                            affiliationsData[match[0]] = new Array(data.length).fill(0);
                        }
                        affiliationsData[match[0]][yearIndex] += affiliation.count;
                        monthTotal += affiliation.count;
                    }
                });

                Object.keys(affiliationsData).forEach(key => {
                    if (monthTotal > 0) {
                        affiliationsData[key][yearIndex] = (affiliationsData[key][yearIndex] / monthTotal) * 100;
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
            tension: 0.1
        }]
    };

    const barChartData = {
        labels,
        datasets: Object.keys(affiliationsData).map((affiliation, index) => ({
            label: affiliation,
            data: affiliationsData[affiliation],
            backgroundColor: `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.6)`,
        }))
    };

    return (
        <div style={{ height: "400px" }}>
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
            {false &&
                <Bar
                    ref={chartRef}
                    data={barChartData}
                    options={{
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'top',
                            },
                            title: {
                                display: true,
                                text: 'Prozentuale Aufschlüsselung der Affiliations',
                            },
                        },
                    }}
                />
            }
        </div>
    );
};

export default DashboardChart;