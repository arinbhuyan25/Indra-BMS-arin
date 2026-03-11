import { useState, useEffect, useRef, useCallback } from "react";

export function useSerial() {
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);
    const [telemetry, setTelemetry] = useState({
        busV: null, current: null, power: null,
        battV: null, cellTemp: null, cycle: null, soc: null, health: null
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
            await port.open({
                baudRate: 115200,
                dataBits: 8,
                stopBits: 1,
                parity: "none",
                flowControl: "none",
                bufferSize: 8192 // Fixes allocation issues on some Windows CH340 drivers
            });
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
                    const line = raw.trim();
                    // Basic JSON check
                    if (line.startsWith("{") && line.endsWith("}")) {
                        try {
                            const parsed = JSON.parse(line);
                            // We only want the telemetry broadcast, ignore event objects
                            if (parsed.busV !== undefined) {
                                setTelemetry(prev => ({
                                    ...prev,
                                    busV: parsed.busV,
                                    current: parsed.current,
                                    power: parsed.power,
                                    battV: parsed.divV,
                                    cellTemp: parsed.cellTemp,
                                    cycle: parsed.cycle,
                                    soc: parsed.soc,
                                    health: parsed.health,
                                    peakV: parsed.peakV,
                                    mAh: parsed.mAh
                                }));
                            }
                        } catch (e) {
                            // Ignored - partial or malformed chunk
                        }
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
        setTelemetry({ busV: null, current: null, power: null, battV: null, cellTemp: null, cycle: null, soc: null, health: null });
    }, []);

    // Cleanup on unmount
    useEffect(() => () => { disconnect(); }, [disconnect]);

    return { connected, error, telemetry, connect, disconnect };
}
