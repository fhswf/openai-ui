import React, { useEffect, useState, useRef } from "react";

import { BarChart, Bar, Rectangle, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Sector, Cell } from 'recharts';

import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { Skeleton, Tabs } from "@chakra-ui/react";
import styles from "./style/dashboard.module.less";
import { getStackGroupsByAxisId } from "recharts/types/util/ChartUtils";


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
    const scopeData = {};
    const roleData = {};
    const labels = [];

    // Daten verarbeiten
    data[0]
        .byScope
        .forEach(yearData => {
            let monthTotal = 0;
            yearData.months
                .sort((a, b) => a.month - b.month)
                .forEach(month => {
                    labels.push(`${month.month}/${yearData._id}`);
                    monthTotal = 0;

                    month.scopes.forEach(scopes => {
                        if (scopes.scope === "fh-swf.de") {
                            totalCounts.push(scopes.count);
                        }

                        // Schlüsseln nach der gewünschten Form
                        const match = scopes.scope.endsWith(".fh-swf.de") && scopes.scope.split(".").length === 3 ? scopes.scope.split(".")[0] : null;
                        console.log("match: ", match);
                        if (match) {
                            if (!scopeData[match]) {
                                scopeData[match] = 0;
                            }
                            scopeData[match] += scopes.count;
                        }
                    });
                });
        });
    data[0]
        .byRole
        .forEach(yearData => {
            let monthTotal = 0;
            yearData.months
                .sort((a, b) => a.month - b.month)
                .forEach(month => {
                    monthTotal = 0;

                    month.roles.forEach(roles => {
                        if (!roleData[roles.role]) {
                            roleData[roles.role] = 0;
                        }
                        roleData[roles.role] += roles.count;
                    });

                });
        });

    console.log("roleData: ", roleData);
    console.log("scopeData: ", scopeData);

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

    const NAMES = {
        "fb-in": ["I&N", "FB Informatik & Naturwissenschaften"],
        "ifv": ["IfV", "Institut für Verbundstudien"],
        "fb-iw": ["IW", "FB Ingenieur- und Wirtschaftswissenschaften"],
        "fb-tbw": ["TBW", "FB Technische Betriebswirtschaft"],
        "fb-m": ["M", "FB Maschinenbau"],
        "fb-ei": ["EI", "FB Elektrotechnik und Informationstechnik"],
        "fb-aw": ["AW", "FB Agrarwissenschaften"],
        "fb-bg": ["BG", "FB Bildungs- und Gesellschaftswissenschaften"],
        "fb-eet": ["EET", "FB Elektrische Energietechnik"],
        "fb-ma": ["MA", "FB Maschinenbau-Automatisierungstechnik"],
        "hv": ["HV", "Hochschulverwaltung"],
        "rektor": ["Rektorat", "Rektorat"],
    }

    const getName = (match: string) => {
        const name = match;
        if (name in NAMES) {
            return NAMES[name];
        }
        const parts = name.split("-");
        if (parts.length > 1) {
            return [parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" "), match];
        }
        return [name.charAt(0).toUpperCase() + name.slice(1), match];
    }

    const getRoleName = (role: string) => {
        switch (role) {
            case "student":
                return t("Student*in");
            case "faculty":
                return t("Professor*in");
            case "staff":
                return t("Mitarbeiter*in");
            default:
                return role;
        }
    }

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
        'rgba(30, 136, 229, 0.8)',
        'rgb(166,206,227)',
        'rgb(31,120,180)',
        'rgb(178,223,138)',
        'rgb(51,160,44)',
        'rgb(251,154,153)',
        'rgb(227,26,28)',
        'rgb(253,191,111)',
        'rgb(255,127,0)',
        'rgb(202,178,214)',
        'rgb(106,61,154)',
        'rgb(255,255,153)',
        'rgb(177,89,40)',

    ];

    const totalAffiliationsCount: number = Object.values(scopeData).reduce((sum: number, count: number) => sum + count, 0) as number;

    const scopeChartData = Object.keys(scopeData)
        .sort((a, b) => scopeData[b] - scopeData[a])
        .map((affiliation, index) => ({
            affiliation,
            name: getName(affiliation)[0],
            longName: getName(affiliation)[1],
            count: scopeData[affiliation],
            value: ((scopeData[affiliation] / totalAffiliationsCount) * 100),
            fill: COLORS[index % COLORS.length],
        }));

    const roleChartData = ["student", "faculty", "staff"]
        .sort((a, b) => roleData[b] - roleData[a])
        .map((role, index) => ({
            name: getRoleName(role),
            longName: getRoleName(role),
            count: roleData[role],
            value: ((roleData[role] / roleData['member']) * 100),
            fill: COLORS[index % COLORS.length],
        }));

    const RADIAN = Math.PI / 180;
    const renderPieLabel = (data) => ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
        const radius = innerRadius + (outerRadius - innerRadius) * 0.8; // Adjust radius to position text in the middle of the pie-piece
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        const rotation = midAngle; // Calculate rotation angle for radial direction

        console.log("label: ", percent, midAngle, data[index]);
        if (percent < 0.02) {
            return null;
        }
        const offset = Math.abs(midAngle) < 90 ? 0 : 180;
        return (
            <text
                x={x}
                y={y}
                fill="white"
                textAnchor={offset ? "start" : "end"}
                dominantBaseline="central"
                transform={`rotate(${snapAngle(offset - rotation)}, ${x}, ${y})`} // Rotate text to align radially
            >
                {`${data[index].name}`}
            </text>
        );
    };

    const CustomTooltip = ({ active, payload, label }) => {

        if (active && payload && payload.length) {
            const { name, longName, count, value } = payload[0].payload;
            const percentage = value.toFixed(1);
            return (
                <div className={styles.tooltip}>
                    <p className="label">{`${longName} : ${percentage}%`}</p>
                    <p className="description">{`${new Intl.NumberFormat().format(count)} Aufrufe`}</p>
                </div>
            );
        }

        return null;
    };

    const getStartAngle = (data) => {
        const maxValue = data[0].value;
        return 180 + maxValue * 1.8;
    }

    const snapAngle = (angle) => {
        const snappedAngle = Math.round(angle / 5) * 5;
        return snappedAngle;
    }

    return (
        <Tabs.Root defaultValue="total_requests" className={styles.chart}>
            <Tabs.List>
                <Tabs.Trigger value="total_requests">
                    {t('total_requests_title')}
                </Tabs.Trigger>
                <Tabs.Trigger value="scope_breakdown">
                    {t('scope_breakdown_title')}
                </Tabs.Trigger>
                <Tabs.Trigger value="role_breakdown">
                    {t('role_breakdown_title')}
                </Tabs.Trigger>
                <Tabs.Indicator />
            </Tabs.List>
            <Tabs.Content value="total_requests" className={styles.chart_container}>
                <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={lineChartData.labels.map((label, index) => ({
                        label,
                        value: lineChartData.datasets[0].data[index],
                    }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis />
                        <Tooltip />
                        <Legend verticalAlign="top" />
                        <Bar dataKey="value" name="Aufrufe" fill="rgba(30, 136, 229, 0.8)" />
                    </BarChart>
                </ResponsiveContainer>
            </Tabs.Content>
            <Tabs.Content value="scope_breakdown" className={styles.chart_container}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={scopeChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            label={renderPieLabel(scopeChartData)}
                            labelLine={false}
                            outerRadius={"100%"}
                            startAngle={getStartAngle(scopeChartData)}
                            endAngle={getStartAngle(scopeChartData) - 360}
                        >
                            {scopeChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                </ResponsiveContainer>
            </Tabs.Content>
            <Tabs.Content value="role_breakdown" className={styles.chart_container}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={roleChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            label={renderPieLabel(roleChartData)}
                            labelLine={false}
                            outerRadius={"100%"}
                            startAngle={getStartAngle(roleChartData)}
                            endAngle={getStartAngle(roleChartData) - 360}
                        >
                            {roleChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                </ResponsiveContainer>
            </Tabs.Content>
        </Tabs.Root >
    );
};

export default DashboardChart;