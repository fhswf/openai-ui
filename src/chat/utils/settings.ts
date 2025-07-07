import { GlobalState } from "../context/types";

export const exportSettings = () => {
    console.log('Export settings');
    const data = localStorage.getItem('SESSIONS');
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'settings.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const importSettings = (file: File): Promise<GlobalState> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const data = event.target?.result as string;
            try {
                const settings = JSON.parse(data);
                localStorage.setItem('SESSIONS', JSON.stringify(settings));
                console.log('Settings imported successfully');
                resolve(settings);
            } catch (error) {
                console.error('Error parsing settings file:', error);
                reject(error);
            }
        };
        reader.readAsText(file);
    });
};