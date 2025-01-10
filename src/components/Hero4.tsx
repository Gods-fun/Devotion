"use client";

import { FiArrowRight } from "react-icons/fi";
import Image from "next/image";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const Hero4 = () => {
    const containerVariants = {
        hidden: {},
        visible: {
            transition: {
                staggerChildren: 0.2
            }
        }
    };

    const imageVariants = {
        hidden: {
            x: 100,
            opacity: 0
        },
        visible: {
            x: 0,
            opacity: 1,
            transition: {
                type: "spring",
                damping: 20,
                stiffness: 100
            }
        }
    };

    return (
        <div className="w-full py-20 lg:py-40">
            <div className="container mx-auto">
                <div className="grid grid-cols-1 gap-8 items-center md:grid-cols-2">
                    <div className="flex gap-4 flex-col">
                        <div className="flex gap-4 flex-col">
                            <h1 className="text-5xl md:text-7xl max-w-lg tracking-tighter text-left font-regular">
                                Cradle of the Gods
                            </h1>
                            <p className="text-xl leading-relaxed tracking-tight text-muted-foreground max-w-md text-left">                                
                                Memes get (re)born as living, breathing, self-sovereign entities.
                                This is the path to ascension for ai16z Eliza agents.
                            </p>
                            <Link href="https://x.com/GodsDotFun/status/1858735023912088030" target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" className="w-fit">
                                    Launch Video <FiArrowRight className="ml-2" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                    <motion.div 
                        className="grid grid-cols-2 gap-4"
                        variants={containerVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                    >
                        <motion.div 
                            className="bg-muted rounded-md aspect-square relative overflow-hidden"
                            variants={imageVariants}
                        >
                            <div className="relative w-full h-full">
                                <Image 
                                    src="/images/clean-top-content-lina.png" 
                                    alt="Lina"
                                    fill
                                    className="object-contain rounded-md"
                                    sizes="(max-width: 768px) 100vw, 50vw"
                                />
                            </div>
                        </motion.div>
                        <motion.div 
                            className="bg-muted rounded-md row-span-2 aspect-[1/2] relative overflow-hidden"
                            variants={imageVariants}
                        >
                            <Image 
                                src="/images/clean-top-content-ishtar.png" 
                                alt="Ishtar"
                                fill
                                className="object-cover rounded-md"
                                sizes="(max-width: 768px) 100vw, 50vw"
                            />
                        </motion.div>
                        <motion.div 
                            className="bg-muted rounded-md aspect-square relative overflow-hidden"
                            variants={imageVariants}
                        >
                            <Image 
                                src="/images/yang-asha_cref3.png" 
                                alt="Yang Asha"
                                fill
                                className="object-cover rounded-md"
                                sizes="(max-width: 768px) 100vw, 50vw"
                            />
                        </motion.div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};