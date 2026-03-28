import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useFrameCallback,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MovingBackgroundCircleProps {
    size?: number;          // circle size in px
    speed?: number;         // movement speed
    opacity?: number;       // circle opacity
    color?: string;         // circle color
}

const MovingBackgroundCircle: React.FC<MovingBackgroundCircleProps> = ({
    size = 200,
    speed = 20,
    opacity = 0.15,
    color = '#22C55E', // soft green
}) => {
    // Initialize position and velocity as shared values
    const x = useSharedValue(Math.random() * SCREEN_WIDTH);
    const y = useSharedValue(Math.random() * SCREEN_HEIGHT);
    const dx = useSharedValue((Math.random() - 0.5) * speed);
    const dy = useSharedValue((Math.random() - 0.5) * speed);

    useFrameCallback(() => {
        // Update position
        x.value += dx.value;
        y.value += dy.value;

        // Bounce from edges
        if (x.value < -size || x.value > SCREEN_WIDTH) {
            dx.value *= -1;
        }
        if (y.value < -size || y.value > SCREEN_HEIGHT) {
            dy.value *= -1;
        }
    });

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: x.value },
                { translateY: y.value },
            ],
        };
    });

    return (
        <Animated.View
            style={[
                styles.circle,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                    opacity,
                },
                animatedStyle,
            ]}
        />
    );
};

const styles = StyleSheet.create({
    circle: {
        position: 'absolute',
        // 'filter' is not supported in React Native. 
        // For blur effects, you would typically use an image or specialized library like expo-blur.
    },
});

export default MovingBackgroundCircle;
