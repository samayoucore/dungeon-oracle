import { useId, useMemo } from 'react';
import type { CharacterRace } from '../../types';
import { generatePortrait } from '../../engine/portraits/generator';
import type { PortraitHair, PortraitSpec, PortraitTrait } from '../../engine/portraits/generator';

interface PortraitProps {
  seed: string;
  roleOrClass?: string;
  race?: CharacterRace;
  size?: number;
}

function Ears({ trait, skin }: { trait: PortraitTrait; skin: string }) {
  if (trait === 'elf-ears') {
    return (
      <g fill={skin} stroke="#211713" strokeWidth="1.5">
        <path d="M34 48 L17 38 L30 57 Z" />
        <path d="M94 48 L111 38 L98 57 Z" />
      </g>
    );
  }
  if (trait === 'soft-ears') {
    return (
      <g fill={skin} stroke="#211713" strokeWidth="1.5">
        <ellipse cx="31" cy="50" rx="8" ry="10" />
        <ellipse cx="97" cy="50" rx="8" ry="10" />
      </g>
    );
  }
  return null;
}

function Trait({ trait, spec }: { trait: PortraitTrait; spec: PortraitSpec }) {
  if (trait === 'horns') {
    return (
      <g fill="#d8c6a8" stroke="#211713" strokeWidth="1.3">
        <path d="M47 24 C42 12 35 10 32 17 C38 18 42 24 43 31 Z" />
        <path d="M81 24 C86 12 93 10 96 17 C90 18 86 24 85 31 Z" />
      </g>
    );
  }
  if (trait === 'tusks') {
    return (
      <g fill="#efe1c4" stroke="#211713" strokeWidth="0.8">
        <path d="M55 70 L50 82 L59 74 Z" />
        <path d="M73 70 L78 82 L69 74 Z" />
      </g>
    );
  }
  if (trait === 'beard') {
    return <path d="M43 68 C47 91 81 91 85 68 C76 77 52 77 43 68 Z" fill={spec.hairColor} opacity="0.95" />;
  }
  return null;
}

function Hair({ hair, spec }: { hair: PortraitHair; spec: PortraitSpec }) {
  if (hair === 'hood') {
    return (
      <path
        d="M30 78 C24 46 35 21 64 17 C93 21 104 46 98 78 C91 48 82 34 64 34 C46 34 37 48 30 78 Z"
        fill={spec.cloakColor}
        stroke={spec.accentColor}
        strokeWidth="2"
      />
    );
  }
  if (hair === 'braids') {
    return (
      <g fill={spec.hairColor}>
        <path d="M36 49 C38 25 51 18 64 18 C77 18 90 25 92 49 C82 36 46 36 36 49 Z" />
        <path d="M35 48 C28 66 28 84 38 103 C44 83 45 64 42 49 Z" />
        <path d="M93 48 C100 66 100 84 90 103 C84 83 83 64 86 49 Z" />
      </g>
    );
  }
  if (hair === 'wild') {
    return (
      <path
        d="M31 51 C28 31 42 17 55 20 L62 13 L70 20 C86 16 101 31 97 52 C88 36 78 32 64 32 C50 32 40 36 31 51 Z"
        fill={spec.hairColor}
      />
    );
  }
  if (hair === 'waves') {
    return (
      <path
        d="M33 55 C31 33 45 18 64 18 C83 18 97 33 95 55 C85 43 80 37 64 37 C48 37 43 43 33 55 Z"
        fill={spec.hairColor}
      />
    );
  }
  return <path d="M35 48 C37 28 48 20 64 20 C80 20 91 28 93 48 C79 38 49 38 35 48 Z" fill={spec.hairColor} />;
}

function HairFront({ hair, spec }: { hair: PortraitHair; spec: PortraitSpec }) {
  if (hair === 'hood') {
    return (
      <path
        d="M35 57 C38 36 48 28 64 28 C80 28 90 36 93 57 C85 44 76 39 64 39 C52 39 43 44 35 57 Z"
        fill={spec.cloakColor}
        opacity="0.95"
      />
    );
  }
  if (hair === 'braids') {
    return (
      <g fill={spec.hairColor}>
        <path d="M39 47 C45 31 55 25 64 25 C73 25 83 31 89 47 C79 39 49 39 39 47 Z" />
        <path d="M48 42 C52 55 48 67 43 76 C42 62 42 51 48 42 Z" />
        <path d="M80 42 C76 55 80 67 85 76 C86 62 86 51 80 42 Z" />
      </g>
    );
  }
  if (hair === 'wild') {
    return (
      <g fill={spec.hairColor}>
        <path d="M36 52 C39 31 49 23 64 24 C79 23 89 31 92 52 C82 43 72 38 64 39 C56 38 46 43 36 52 Z" />
        <path d="M47 37 L38 59 L55 47 Z" />
        <path d="M81 37 L90 59 L73 47 Z" />
        <path d="M60 28 L54 53 L70 34 Z" />
      </g>
    );
  }
  if (hair === 'waves') {
    return (
      <g fill={spec.hairColor}>
        <path d="M38 52 C39 32 51 25 64 25 C77 25 89 32 90 52 C80 42 73 38 64 39 C55 38 48 42 38 52 Z" />
        <path d="M43 45 C49 49 55 49 61 43 C58 54 49 58 42 53 Z" />
        <path d="M85 45 C79 49 73 49 67 43 C70 54 79 58 86 53 Z" />
      </g>
    );
  }
  return (
    <g fill={spec.hairColor}>
      <path d="M39 49 C41 32 51 25 64 25 C77 25 87 32 89 49 C80 42 48 42 39 49 Z" />
      <path d="M49 41 C54 48 61 50 68 39 C66 52 56 57 47 50 Z" />
    </g>
  );
}

function Face({ spec }: { spec: PortraitSpec }) {
  const mouth = spec.expression === 'bright' ? 'M56 73 Q64 79 72 73' : spec.expression === 'stern' ? 'M57 76 L72 75' : 'M57 74 Q64 77 71 74';

  return (
    <g>
      <ellipse cx="64" cy="55" rx={spec.faceWidth} ry={spec.faceHeight} fill={spec.skinTone} stroke="#211713" strokeWidth="1.8" />
      <circle cx="52" cy="56" r="3.3" fill={spec.eyeColor} />
      <circle cx="76" cy="56" r="3.3" fill={spec.eyeColor} />
      <path d="M48 49 Q53 46 58 49" stroke={spec.hairColor} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M70 49 Q75 46 80 49" stroke={spec.hairColor} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M64 58 L61 67 L67 67" stroke="#7b4a35" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
      <path d={mouth} stroke="#5b2f2f" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** Deterministic procedural character bust. */
export default function Portrait({ seed, roleOrClass, race, size = 48 }: PortraitProps) {
  const spec = useMemo(() => generatePortrait(seed, roleOrClass, race), [seed, roleOrClass, race]);
  const gradientId = useId().replace(/:/g, '');

  return (
    <svg width={size} height={size} viewBox="0 0 128 128" role="img" aria-label="Портрет персонажа">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={spec.background} />
          <stop offset="100%" stopColor="#0d1117" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="24" fill={`url(#${gradientId})`} />
      <path d="M12 98 C30 84 98 84 116 98 L122 128 H6 Z" fill={spec.cloakColor} />
      <path d="M41 96 L64 113 L87 96" stroke={spec.accentColor} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="64" cy="121" rx="41" ry="9" fill="#000" opacity="0.22" />
      <rect x="54" y="81" width="20" height="23" rx="8" fill={spec.skinTone} />
      <Ears trait={spec.trait} skin={spec.skinTone} />
      {spec.trait !== 'beard' && <Trait trait={spec.trait} spec={spec} />}
      <Hair hair={spec.hair} spec={spec} />
      <Face spec={spec} />
      <HairFront hair={spec.hair} spec={spec} />
      {spec.trait === 'beard' && <Trait trait="beard" spec={spec} />}
      <circle cx="101" cy="103" r="13" fill={spec.accentColor} stroke="#0d1117" strokeWidth="4" />
      <path d="M96 103 H106 M101 98 V108" stroke="#0d1117" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
