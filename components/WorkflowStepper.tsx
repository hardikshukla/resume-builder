import React from 'react';
import { Stepper, Step, StepLabel, StepButton, Tooltip, Box } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';

interface WorkflowStepperProps {
  activeStep: number;
  isLoading: boolean;
  hasOutput: boolean;
  onStepChange: (step: number) => void;
}

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  activeStep,
  isLoading,
  hasOutput,
  onStepChange,
}) => {
  const steps = [
    { label: 'Input', enabled: true },
    { label: 'Analyze & Generate', enabled: true },
    { label: 'Review & Edit', enabled: hasOutput },
    { label: 'Export', enabled: hasOutput },
  ];

  return (
    <Box sx={{ width: '100%', mb: 3 }}>
      <Stepper activeStep={activeStep} alternativeLabel>
        {steps.map((step, index) => {
          const isStepLoading = index === 1 && isLoading;

          const labelContent = (
            <StepLabel
              sx={isStepLoading
                ? {
                    animation: 'pulse 1.5s infinite ease-in-out',
                    '@keyframes pulse': {
                      '0%': { opacity: 0.6 },
                      '50%': { opacity: 1 },
                      '100%': { opacity: 0.6 },
                    },
                  }
                : {}}
            >
              <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                <span>{step.label}</span>
                {!step.enabled && (
                  <LockIcon
                    sx={{
                      fontSize: 14,
                      ml: 0.5,
                      verticalAlign: 'middle',
                      color: 'text.disabled',
                    }}
                  />
                )}
              </Box>
            </StepLabel>
          );

          return (
            <Step key={step.label}>
              {step.enabled ? (
                <StepButton onClick={() => onStepChange(index)}>
                  {labelContent}
                </StepButton>
              ) : (
                <Tooltip title="Generate first to unlock this step" arrow>
                  <span>
                    <StepButton disabled style={{ cursor: 'not-allowed' }}>
                      {labelContent}
                    </StepButton>
                  </span>
                </Tooltip>
              )}
            </Step>
          );
        })}
      </Stepper>
    </Box>
  );
};
