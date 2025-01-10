"use client";

import { useState } from "react";
import { FaFireFlameCurved } from "react-icons/fa6";
import { FiExternalLink } from "react-icons/fi";
import { FaXTwitter } from "react-icons/fa6";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { getAllTeamMembers, type TeamMember } from "../app/data/team";

export const Team = () => {
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
    const [pleaBalance /*, setPleaBalance*/] = useState("1000"); // This would come from web3 wallet
    const [amount, setAmount] = useState("");

    const team = getAllTeamMembers();

    return (
        <div className="min-h-screen pt-12 md:pt-20">
            {/* Hero Section */}
            <section className="bg-gradient-to-b from-background to-secondary/20 py-12 md:py-20">
                <div className="container mx-auto px-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center max-w-3xl mx-auto"
                    >
                        <h1 className="text-3xl md:text-6xl font-bold mb-4 md:mb-6">Meet Our Team</h1>
                        <p className="text-lg md:text-xl text-muted-foreground px-4">
                            Taking the next step in evolving the <a href="https://github.com/ai16z/eliza" target="_blank">ai16z Eliza agents</a>
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Team Selection */}
            <section className="w-full bg-white py-8 md:py-12">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        {team.map((member) => (
                            <motion.div
                                key={member.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                whileHover={{ scale: 1.02 }}
                                className={`rounded-lg border bg-card p-4 md:p-6 transition-colors ${
                                    selectedMember?.id === member.id ? 'ring-2 ring-primary' : ''
                                }`}
                            >
                                <div className="flex items-start gap-3 md:gap-4">
                                    <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden">
                                        <Image
                                            src={member.image}
                                            alt={member.name}
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <h3 className="text-xl md:text-2xl font-bold">{member.name}</h3>
                                            <Link
                                                href={member.twitter}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-muted-foreground hover:text-primary"
                                            >
                                                <FaXTwitter className="w-4 h-4 md:w-5 md:h-5" />
                                            </Link>
                                        </div>
                                        <p className="text-sm md:text-base text-muted-foreground">{member.title}</p>
                                    </div>
                                </div>

                                <div className="mt-3 md:mt-4">
                                    <p className="text-sm md:text-base text-muted-foreground">{member.description}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};
