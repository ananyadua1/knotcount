import React from 'react';
import Svg, { Circle, Line, Path, Rect, G } from 'react-native-svg';
import { C } from '../theme';

export const Person = ({ size = 28, color = C.ink }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round">
    <Circle cx="12" cy="8.5" r="3.6" />
    <Path d="M4.6 20.2c.7-3.6 3.7-5.6 7.4-5.6s6.7 2 7.4 5.6" />
  </Svg>
);

export const Plate = ({ veg, width = 150 }) => (
  <Svg width={width} height={width * 0.56} viewBox="0 0 150 84" fill="none" stroke={C.ink} strokeWidth={1.4} strokeLinecap="round">
    <Path d="M14 6v24c0 4 3 6 6 6v40M14 6v18M20 6v18M26 6v24c0 4-3 6-6 6" />
    <Circle cx="75" cy="42" r="36" />
    <Circle cx="75" cy="42" r="27" />
    {veg ? (
      <G>
        <Rect x="63" y="30" width="24" height="24" rx="4" />
        <Circle cx="75" cy="42" r="5" fill={C.leaf} stroke="none" />
      </G>
    ) : (
      <G>
        <Rect x="63" y="30" width="24" height="24" rx="4" />
        <Path d="M75 35.5l6 10h-12z" fill={C.sindoor} stroke="none" />
      </G>
    )}
    <Path d="M136 6c-5 3-7 12-7 20 0 5 2 7 5 7v43" />
  </Svg>
);

// analogue clock showing hh:mm
export function Clock({ hour = 19, minute = 0, size = 220 }) {
  const cx = 100, cy = 100;
  const mAng = (minute / 60) * 360;
  const hAng = (((hour % 12) + minute / 60) / 12) * 360;
  const pt = (ang, r) => [cx + r * Math.sin((ang * Math.PI) / 180), cy - r * Math.cos((ang * Math.PI) / 180)];
  const ticks = [];
  for (let i = 0; i < 12; i++) {
    const major = i % 3 === 0;
    const a = i * 30;
    const [x1, y1] = pt(a, major ? 78 : 83);
    const [x2, y2] = pt(a, 90);
    ticks.push(<Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.ink} strokeWidth={major ? 3 : 1.2} strokeLinecap="round" />);
  }
  const [mx, my] = pt(mAng, 72);
  const [hx, hy] = pt(hAng, 48);
  const [tx, ty] = pt(hAng + 180, 10);
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Circle cx={cx} cy={cy} r="97" stroke={C.ink} strokeWidth="1.6" fill="none" />
      {ticks}
      <Line x1={cx} y1={cy} x2={mx} y2={my} stroke={C.ink} strokeWidth="2.2" strokeLinecap="round" />
      <Line x1={tx} y1={ty} x2={hx} y2={hy} stroke={C.ink} strokeWidth="4" strokeLinecap="round" />
      <Circle cx={cx} cy={cy} r="4.5" fill={C.ink} />
    </Svg>
  );
}
