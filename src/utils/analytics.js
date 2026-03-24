import mixpanel from 'mixpanel-browser';

mixpanel.init(import.meta.env.VITE_MIXPANEL_TOKEN, {
  track_pageview: "url-with-path",
  persistence: 'localStorage'
});

// Check for mp_id in URL params (for cross-domain identity linking)
const urlParams = new URLSearchParams(window.location.search);
const mpId = urlParams.get('mp_id');
if (mpId) {
  mixpanel.identify(mpId);
}

const analytics = {
  scorecardStarted: () => {
    mixpanel.track('Scorecard Started');
  },

  stepCompleted: (stepNumber, stepName = '') => {
    mixpanel.track('Scorecard Step Completed', {
      step_number: stepNumber,
      step_name: stepName,
      total_steps: 15
    });
  },

  scorecardSubmitted: (score = null, answers = {}) => {
    mixpanel.track('Scorecard Submitted', {
      score,
      ...answers
    });

    if (score !== null) {
      mixpanel.people.set({
        scorecard_score: score,
        scorecard_completed_at: new Date().toISOString()
      });
    }
  },

  callBooked: (source = 'scorecard') => {
    mixpanel.track('Call Booked', { source });
  },

  identifyUser: (email, properties = {}) => {
    mixpanel.identify(email);
    mixpanel.people.set({
      $email: email,
      ...properties
    });
  }
};

export default analytics;
