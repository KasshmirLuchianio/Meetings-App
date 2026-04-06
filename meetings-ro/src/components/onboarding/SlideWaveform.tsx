import React, { useEffect, useState } from 'react';
import { View, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width } = Dimensions.get('window');
const W = width;
const H = 200;

const generateWavePath = (amplitude: number, frequency: number, offset: number) => {
  let d = `M 0 ${H / 2}`;
  for (let x = 0; x <= W; x += 4) {
    const y = H / 2 + amplitude * Math.sin((x / W) * Math.PI * frequency + offset);
    d += ` L ${x} ${y}`;
  }
  return d;
};

export default function SlideWaveform() {
  const [offset1, setOffset1] = useState(0);
  const [offset2, setOffset2] = useState(Math.PI);

  useEffect(() => {
    let frame: number;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      setOffset1(elapsed * 2);
      setOffset2(elapsed * 1.3 + Math.PI);
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <View style={{ width: W, height: H }}>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="grad1" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FF6B9D" stopOpacity="0.8" />
            <Stop offset="0.5" stopColor="#CC44FF" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#00CFFF" stopOpacity="0.8" />
          </LinearGradient>
          <LinearGradient id="grad2" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#00CFFF" stopOpacity="0.6" />
            <Stop offset="0.5" stopColor="#7B2FFF" stopOpacity="0.7" />
            <Stop offset="1" stopColor="#FF6B9D" stopOpacity="0.6" />
          </LinearGradient>
        </Defs>
        {/* Undă principală */}
        <Path
          d={generateWavePath(45, 4, offset1)}
          stroke="url(#grad1)"
          strokeWidth="2.5"
          fill="none"
        />
        {/* Undă secundară */}
        <Path
          d={generateWavePath(30, 3, offset2)}
          stroke="url(#grad2)"
          strokeWidth="1.5"
          fill="none"
        />
        {/* Undă terțiară subtilă */}
        <Path
          d={generateWavePath(20, 5, offset1 * 1.5)}
          stroke="#FFFFFF"
          strokeWidth="0.8"
          strokeOpacity={0.3}
          fill="none"
        />
      </Svg>
    </View>
  );
}
