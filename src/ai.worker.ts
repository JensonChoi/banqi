import { chooseAction, type Observation, type Difficulty } from './ai';
self.onmessage = (event: MessageEvent<{
    observation: Observation;
    difficulty: Difficulty;
    seed: number;
}>) => {
    try {
        self.postMessage({
            action: chooseAction(event.data.observation, event.data.difficulty, event.data.seed)
        });
    }
    catch (error) {
        self.postMessage({
            error: String(error)
        });
    }
};
