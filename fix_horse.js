const fs = require('fs');
const file = fs.readFileSync('src/components/FluidHorseAnimation.jsx', 'utf8');

const viewBoxMatch = file.match(/<animate[^>]*attributeName="viewBox"[^>]*values="([^"]+)"/);
const transformMatch = file.match(/<animateTransform[^>]*attributeName="transform"[^>]*values="([^"]+)"/);
const pathMatch = file.match(/<animate[^>]*attributeName="d"[^>]*values="([^"]+)"/);

if (!viewBoxMatch || !transformMatch || !pathMatch) {
  console.log("Could not find all animation values");
  process.exit(1);
}

const viewBoxes = viewBoxMatch[1].split(';');
const transforms = transformMatch[1].split(';');
const paths = pathMatch[1].split(';');

const newFileContent = `import React, { useEffect, useRef } from 'react';

// Animation frames extracted for perfect instantaneous playback
const viewBoxFrames = ${JSON.stringify(viewBoxes)};
const transformFrames = ${JSON.stringify(transforms)};
const pathFrames = ${JSON.stringify(paths)};

export default function FluidHorseAnimation({ className = '', duration = 1.3 }) {
  const svgRef = useRef(null);
  const pathRef = useRef(null);
  const groupRef = useRef(null);
  const frameRef = useRef(0);

  useEffect(() => {
    // 13 frames for the given duration
    const numFrames = pathFrames.length;
    const intervalMs = (duration * 1000) / numFrames;

    let animationFrameId;
    let lastTime = performance.now();

    const animate = (time) => {
      if (time - lastTime >= intervalMs) {
        lastTime = time;
        frameRef.current = (frameRef.current + 1) % numFrames;
        const currentFrame = frameRef.current;
        
        if (svgRef.current && pathRef.current && groupRef.current) {
          svgRef.current.setAttribute('viewBox', viewBoxFrames[currentFrame]);
          groupRef.current.setAttribute('transform', \`translate(\${transformFrames[currentFrame]})\`);
          pathRef.current.setAttribute('d', pathFrames[currentFrame]);
        }
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [duration]);

  return (
    <div className={\`flex flex-col items-center justify-center \${className || 'w-full h-full'}\`}>
      <div className="relative w-full aspect-square">
        <svg
          ref={svgRef}
          className="w-full h-full drop-shadow-2xl overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
          viewBox={viewBoxes[0]}
        >
          <g ref={groupRef} transform={\`translate(\${transforms[0]})\`}>
            <path ref={pathRef} fill="currentColor" d={paths[0]} />
          </g>
        </svg>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/components/FluidHorseAnimation.jsx', newFileContent);
console.log("Successfully rewrote FluidHorseAnimation.jsx with JS-based animation.");
