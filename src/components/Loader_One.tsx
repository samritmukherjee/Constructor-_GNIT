import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, ImageSourcePropType, StyleSheet } from 'react-native';

interface LoaderOneProps {
    images?: ImageSourcePropType[];
    size?: number;
    duration?: number;
    scaleAmount?: number;
    delayBetweenImages?: number;
    containerStyle?: object;
}

const Loader_One: React.FC<LoaderOneProps> = ({
    images = [
        require('../../public/assets/potato.png'),
        require('../../public/assets/wheat.png'),
        require('../../public/assets/corn.png'),
    ],
    size = 80,
    duration = 1200,
    scaleAmount = 1.4,
    delayBetweenImages = 100,
    containerStyle = {},
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const animationValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Reset animation value for the new cycle
        animationValue.setValue(0);

        Animated.timing(animationValue, {
            toValue: 1,
            duration: duration,
            easing: Easing.bezier(0.4, 0.0, 0.2, 1),
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished) {
                setTimeout(() => {
                    setCurrentIndex((prev) => (prev + 1) % images.length);
                }, delayBetweenImages);
            }
        });

        // Cleanup function to stop animation if component unmounts
        return () => {
            animationValue.stopAnimation();
        };
    }, [currentIndex, duration, delayBetweenImages, images.length, animationValue]);

    // Determine animation type based on index
    // Even index (0, 2...): Rotate Z (Spin)
    // Odd index (1, 3...): Rotate Towards Screen (Zoom/Flip)
    const isTowardsScreen = currentIndex % 2 !== 0;

    // Common Opacity: Fade In -> Stay -> Fade Out
    const opacity = animationValue.interpolate({
        inputRange: [0, 0.15, 0.85, 1],
        outputRange: [1, 1, 1, 1],
    });

    // Dynamic transforms based on type
    let transform: any[] = [{ perspective: 1000 }];

    if (isTowardsScreen) {
        // "Towards Screen": Start small, zoom in/out towards camera
        transform.push({
            scale: animationValue.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.5, scaleAmount, 0.8],
            }),
        });
        // Add varying rotation to enhance 3D feel
        transform.push({
            rotateX: animationValue.interpolate({
                inputRange: [0, 1],
                outputRange: ['20deg', '-20deg'],
            }),
        });
    } else {
        // "Rotate Z": Standard Spin with slight scale entrance
        transform.push({
            rotateZ: animationValue.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
            }),
        });
        transform.push({
            scale: animationValue.interpolate({
                inputRange: [0, 0.2, 0.8, 1],
                outputRange: [0.5, 1, 1, 0.5],
            }),
        });
    }

    return (
        <View style={[styles.container, { width: size, height: size }, containerStyle]}>
            <Animated.View
                style={{
                    width: size,
                    height: size,
                    justifyContent: 'center',
                    alignItems: 'center',
                    overflow: 'hidden',
                }}
            >
                <Animated.Image
                    source={images[currentIndex]}
                    resizeMode="contain"
                    style={{
                        width: size,
                        height: size,
                        opacity,
                        transform,
                    }}
                />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
});

export default Loader_One;
