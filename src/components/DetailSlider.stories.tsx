/**
 * DetailSlider stories.
 */

import { useState } from 'react';
import type { Meta, StoryFn } from '@storybook/react';
import { Button } from '@mieweb/ui/components/Button';
import { DetailSlider } from '../components/DetailSlider';

const meta = {
  title: 'Grid/DetailSlider',
  component: DetailSlider,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof DetailSlider>;

export default meta;

export const Default: StoryFn = () => {
    const [open, setOpen] = useState(false);
    return (
      <div className="p-8 min-h-screen">
        <Button onClick={() => setOpen(true)}>
          Open Detail Slider
        </Button>

        <DetailSlider
          open={open}
          header="Row Detail — Alice"
          onClose={() => setOpen(false)}
        >
          <div className="space-y-3">
            <div>
              <strong className="text-xs text-gray-500 uppercase">Name</strong>
              <p>Alice Johnson</p>
            </div>
            <div>
              <strong className="text-xs text-gray-500 uppercase">Department</strong>
              <p>Engineering</p>
            </div>
            <div>
              <strong className="text-xs text-gray-500 uppercase">Age</strong>
              <p>30</p>
            </div>
            <div>
              <strong className="text-xs text-gray-500 uppercase">Notes</strong>
              <p className="text-gray-600">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
            </div>
          </div>
        </DetailSlider>
      </div>
    );
  };
