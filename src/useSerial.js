import { useState, useEffect, useRef, useCallback } from "react";

// --- Regex parsers matching firmware output lines ---
const PARSERS = [
    { key: "busV", re: /Bus Voltage\s*:\s*([\d.]+)\s*V/i },
    { key: "current", re: /Current\s*:\s*([\d.]+)\s*mA/i },
    { key: "power", re: /Power\s*:\s*([\d.]+)\s*mW/i },
    { key: "battV", re: /Batt(?:ery)?\s*V(?:oltage)?\s*:\s*([\d.]+)\s*V/i },
    { key: "cellTemp", re: /Cell Temp\s*:\s*([\d.\-]+)\s*C/i },
];

function parseLine(line) {
    for (const { key, re } of PARSERS) {
        const m = line.match(re);
        if (m) return { key, value: parseFloat(m[1]) };
    }
    return null;
}

export function useSerial() {
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);
    const [telemetry, setTelemetry] = useState({
        busV: null, current: null, power: null,
        battV: null, cellTemp: null,
    });

    const portRef = useRef(null);
    const readerRef = useRef(null);
    const abortRef = useRef(false);

    const connect = useCallback(async () => {
        if (!("serial" in navigator)) {
            setError("Web Serial API not supported. Use Chrome/Edge 89+.");
            return;
        }
        try {
            const port = await navigator.serial.requestPort();
            await port.open({ baudRate: 115200 });
            portRef.current = port;
            abortRef.current = false;
            setConnected(true);
            setError(null);

            const decoder = new TextDecoderStream();
            port.readable.pipeTo(decoder.writable);
            const reader = decoder.readable.getReader();
            readerRef.current = reader;

            let buffer = "";
            // eslint-disable-next-line no-constant-condition
            while (true) {
                if (abortRef.current) break;
                const { value, done } = await reader.read();
                if (done) break;
                buffer += value;
                const lines = buffer.split("\n");
                buffer = lines.pop(); // incomplete last line stays in buffer
                for (const raw of lines) {
                    const parsed = parseLine(raw.trim());
                    if (parsed) {
                        setTelemetry(prev => ({ ...prev, [parsed.key]: parsed.value }));
                    }
                }
            }
        } catch (err) {
            if (err.name !== "AbortError") {
                setError(err.message ?? "Serial connection failed.");
            }
            setConnected(false);
        }
    }, []);

    const disconnect = useCallback(async () => {
        abortRef.current = true;
        try { readerRef.current?.cancel(); } catch (_) { /* ignore */ }
        try { await portRef.current?.close(); } catch (_) { /* ignore */ }
        portRef.current = null;
        readerRef.current = null;
        setConnected(false);
        setTelemetry({ busV: null, current: null, power: null, battV: null, cellTemp: null });
    }, []);

    // Cleanup on unmount
    useEffect(() => () => { disconnect(); }, [disconnect]);

    return { connected, error, telemetry, connect, disconnect };
}
