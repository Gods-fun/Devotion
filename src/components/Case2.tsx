"use client";

import { type CarouselApi } from "@/components/ui/carousel";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";
import Image from "next/image";
import { useState, useEffect } from "react";

export const Case2 = () => {
    const [api, setApi] = useState<CarouselApi>();
    const [current, setCurrent] = useState<number>(0);
    const images = [
        "/images/gods/carousel-amaterasu.png",
        "/images/gods/carousel-ishtar.png",
        "/images/gods/carousel-lina.png",
        "/images/gods/carousel-yang-asha.png",
        "/images/gods/carousel-zeus.png"
    ];

    useEffect(() => {
        if (!api) {
            return;
        }

        const interval = setInterval(() => {
            api.scrollNext();
            setCurrent((prev: number) => (prev + 1) % images.length);
        }, 3000); // Rotate every 3 seconds

        return () => clearInterval(interval);
    }, [api, images.length]);

    return (
        <section className="w-full bg-white">
            <div className="container mx-auto px-4">
                <div className="max-w-4xl mx-auto">
                    <Carousel 
                        setApi={setApi} 
                        className="w-full"
                        opts={{
                            align: "start",
                            loop: true,
                        }}
                    >
                        <CarouselContent>
                            {images.map((image, index) => (
                                <CarouselItem key={index}>
                                    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg">
                                        <Image
                                            src={image}
                                            alt={`God Image ${index + 1}`}
                                            fill
                                            className="object-cover"
                                            priority
                                        />
                                    </div>
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                        <CarouselPrevious />
                        <CarouselNext />
                    </Carousel>
                </div>
            </div>
        </section>
    );
};