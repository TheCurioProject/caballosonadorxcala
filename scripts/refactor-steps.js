const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/booking/PremiumBookingModal.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Replace useState<number>(1) with useState<string>('dates')
content = content.replace(/const \[step, setStep\] = useState<number>\(1\);/, "const [step, setStep] = useState<string>('dates');");

// 2. Add getActiveSteps function before nextStep
const getActiveStepsCode = `
  const getActiveSteps = useCallback(() => {
    const steps = ['dates', 'food_prompt'];
    if (wantsCook) {
      steps.push('food_service');
      const isPersonalized = selectedCookService?.name?.toLowerCase().includes('personalized') || selectedCookService?.name?.toLowerCase().includes('personalizado');
      if (isPersonalized) {
        steps.push('food_plan');
      }
      const isDinner = selectedCookService?.name?.toLowerCase().includes('dinner') || selectedCookService?.name?.toLowerCase().includes('cena');
      if (isDinner || totalCookServices > 0) {
        steps.push('menu');
      }
    }
    steps.push('tours', 'checkout', 'success');
    return steps;
  }, [wantsCook, selectedCookService, totalCookServices]);

  const activeSteps = getActiveSteps();
  const currentStepIndex = activeSteps.indexOf(step) + 1;
  const totalStepsCount = activeSteps.length - 1; // Exclude success

  const nextStep = () => setStep(s => {
    const steps = getActiveSteps();
    const idx = steps.indexOf(s);
    if (idx >= 0 && idx < steps.length - 1) {
      return steps[idx + 1];
    }
    return s;
  });

  const prevStep = () => {
    setStep(s => {
      const steps = getActiveSteps();
      const idx = steps.indexOf(s);
      
      let nextStepId = s;
      if (idx > 0) {
        nextStepId = steps[idx - 1];
      }
      
      // Reset answers if going back to previous prompts
      if (nextStepId === 'food_prompt') setWantsCook(null);
      if (nextStepId === 'tours') setWantsATV(null);
      
      return nextStepId;
    });
  };

  const getBackButtonText = () => {
    if (step === 'food_prompt') return dict.modal?.backToCalendar || (isEn ? 'Back to calendar' : 'Volver al calendario');
    return isEn ? 'Back' : 'Volver';
  };

  const showBackButton = () => {
    if (step === 'food_prompt' && wantsCook !== null) return false;
    if (step === 'tours' && wantsATV !== null) return false;
    return true;
  };
`;

// Replace the old nextStep, prevStep, getBackButtonText, showBackButton
content = content.replace(/const nextStep = \(\) => setStep\(s => \{[\s\S]*?return true;\n  \};/, getActiveStepsCode.trim());

// 3. Update StepIndicator definition 
// It currently takes `currentStep={step} totalSteps={6}`
// We will update its invocations
content = content.replace(/<StepIndicator currentStep=\{step\} totalSteps=\{6\} \/>/g, "<StepIndicator currentStep={currentStepIndex} totalSteps={totalStepsCount} />");
content = content.replace(/step > 1 && step <= 5/g, "currentStepIndex > 1 && currentStepIndex <= totalStepsCount");


fs.writeFileSync(filePath, content);
console.log('Step 1 replacements done');
