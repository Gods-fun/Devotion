export interface TeamMember {
    id: string;
    name: string;
    title: string;
    description: string;
    twitter: string;
    image: string;
}

export const teamData: Record<string, TeamMember> = {
      penguin: {
        id: "penguin",
        name: "penguin",
        title: "c0mput3rxz",
        description: "Flightless Bird", //Coder of contracts, deployer of worlds, artist at heart, and hoards NFTs like a dragon
        twitter: "https://x.com/c0mput3rxz",
        image: "/images/pfps/penguin.png"
    },
    st4rgard3n: {
        id: "st4rgard3n",
        name: "st4rgard3n",
        title: "Lina's papa",
        description: "Wizard", //As Lina's papa he changed the world, he connects the right people, and pushes code that moves mountains
        twitter: "https://x.com/KyleSt4rgarden",
        image: "/images/pfps/stargarden.png"
    },
    joshua: {
        id: "0xJoshua",
        name: "0xJoshua",
        title: "Shiva",
        description: "Hunter", //Business developer, spider on top of web3, and definition of the word scope creep
        twitter: "https://x.com/0xJoshuaSL",
        image: "/images/pfps/oxjoshua.png"
    },
    robin: {
        id: "robin",
        name: "robin",
        title: "Zeus",
        description: "Warlock", //Old school AI adopter, initiator of data collectives, ASI community builder, and still coding
        twitter: "https://x.com/w1kke",
        image: "/images/pfps/robin.png"
    }
};

// Utility functions to work with the team data
export function getAllTeamMembers(): TeamMember[] {
    return Object.values(teamData);
}

export function getTeamMemberById(id: string): TeamMember | undefined {
    return teamData[id];
}
